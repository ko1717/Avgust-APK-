#!/usr/bin/env python3
"""Ajusta el AndroidManifest.xml binario de la semilla Capacitor.

El APK base se distribuye compilado. Este guion reescribe el AXML de la copia
extraída (no el binario de tools/base/): versionName, versionCode, y deja
android:debuggable y android:allowBackup en false para el paquete de campo.
"""

from __future__ import annotations

import argparse
import struct
import sys

RES_STRING_POOL_TYPE = 0x0001
RES_XML_START_ELEMENT_TYPE = 0x0102
UTF8_FLAG = 1 << 8
TYPE_INT_BOOLEAN = 0x12
TYPE_INT_DEC = 0x10
TYPE_STRING = 0x03


class StringPool:
    def __init__(self, data: bytes, start: int) -> None:
        self.start = start
        chunk_type, header_size, size = struct.unpack_from("<HHI", data, start)
        if chunk_type != RES_STRING_POOL_TYPE:
            raise ValueError("el chunk indicado no es un string pool")
        self.header_size = header_size
        self.size = size
        (
            self.string_count,
            self.style_count,
            self.flags,
            self.strings_start,
            self.styles_start,
        ) = struct.unpack_from("<IIIII", data, start + 8)
        self.is_utf8 = bool(self.flags & UTF8_FLAG)
        self.offsets = list(
            struct.unpack_from("<%dI" % self.string_count, data, start + header_size)
        )
        self.style_offsets = list(
            struct.unpack_from(
                "<%dI" % self.style_count,
                data,
                start + header_size + 4 * self.string_count,
            )
        )
        data_start = start + self.strings_start
        data_end = start + (self.styles_start or self.size)
        self.blob = data[data_start:data_end]
        self.styles_blob = data[start + self.styles_start : start + self.size] if self.style_count else b""

    def decode(self, index: int) -> str:
        offset = self.offsets[index]
        if self.is_utf8:
            cursor = offset
            length = self.blob[cursor]
            cursor += 2 if length & 0x80 else 1
            byte_length = self.blob[cursor]
            if byte_length & 0x80:
                byte_length = ((byte_length & 0x7F) << 8) | self.blob[cursor + 1]
                cursor += 2
            else:
                cursor += 1
            return self.blob[cursor : cursor + byte_length].decode("utf-8")
        cursor = offset
        length = struct.unpack_from("<H", self.blob, cursor)[0]
        cursor += 2
        if length & 0x8000:
            length = ((length & 0x7FFF) << 16) | struct.unpack_from("<H", self.blob, cursor)[0]
            cursor += 2
        return self.blob[cursor : cursor + length * 2].decode("utf-16-le")

    def find(self, needle: str) -> int:
        for index in range(self.string_count):
            if self.decode(index) == needle:
                return index
        return -1

    def encode(self, value: str) -> bytes:
        if self.is_utf8:
            raw = value.encode("utf-8")
            utf16_length = len(value.encode("utf-16-le")) // 2
            return self._length_utf8(utf16_length) + self._length_utf8(len(raw)) + raw + b"\x00"
        units = len(value.encode("utf-16-le")) // 2
        if units > 0x7FFF:
            header = struct.pack("<HH", 0x8000 | (units >> 16), units & 0xFFFF)
        else:
            header = struct.pack("<H", units)
        return header + value.encode("utf-16-le") + b"\x00\x00"

    @staticmethod
    def _length_utf8(length: int) -> bytes:
        if length > 0x7F:
            return bytes([0x80 | (length >> 8), length & 0xFF])
        return bytes([length])

    def replace(self, index: int, value: str) -> bytes:
        """Devuelve el chunk completo con la cadena `index` sustituida."""
        entries = [self.encode(self.decode(i)) for i in range(self.string_count)]
        entries[index] = self.encode(value)

        new_blob = b""
        new_offsets = []
        for entry in entries:
            new_offsets.append(len(new_blob))
            new_blob += entry
        padding = (-len(new_blob)) % 4
        new_blob += b"\x00" * padding

        header_size = self.header_size
        strings_start = header_size + 4 * self.string_count + 4 * self.style_count
        styles_start = strings_start + len(new_blob) if self.style_count else 0
        size = strings_start + len(new_blob) + len(self.styles_blob)

        chunk = struct.pack("<HHI", RES_STRING_POOL_TYPE, header_size, size)
        chunk += struct.pack(
            "<IIIII",
            self.string_count,
            self.style_count,
            self.flags,
            strings_start,
            styles_start,
        )
        chunk += b"\x00" * (header_size - len(chunk))
        chunk += struct.pack("<%dI" % self.string_count, *new_offsets)
        chunk += struct.pack("<%dI" % self.style_count, *self.style_offsets)
        chunk += new_blob + self.styles_blob
        return chunk


def attribute_offsets(data: bytes | bytearray, pool: StringPool, attr_name: str) -> list[int]:
    name_index = pool.find(attr_name)
    if name_index < 0:
        return []

    found: list[int] = []
    cursor = pool.start + pool.size
    total = struct.unpack_from("<I", data, 4)[0]
    while cursor < total - 8:
        chunk_type, header_size, size = struct.unpack_from("<HHI", data, cursor)
        if size <= 0:
            break
        if chunk_type == RES_XML_START_ELEMENT_TYPE:
            attribute_start, attribute_size, attribute_count = struct.unpack_from(
                "<HHH", data, cursor + header_size + 8
            )
            base = cursor + header_size + attribute_start
            for i in range(attribute_count):
                offset = base + i * attribute_size
                attr_index = struct.unpack_from("<I", data, offset + 4)[0]
                if attr_index == name_index:
                    found.append(offset)
        cursor += size
    return found


def patch_version_code(data: bytearray, pool: StringPool, version_code: int) -> bool:
    offsets = attribute_offsets(data, pool, "versionCode")
    if not offsets:
        return False
    for offset in offsets:
        struct.pack_into("<I", data, offset + 16, version_code)
    return True


def patch_boolean_attribute(data: bytearray, pool: StringPool, attr_name: str, value: bool) -> bool:
    offsets = attribute_offsets(data, pool, attr_name)
    if not offsets:
        return False
    packed = 0xFFFFFFFF if value else 0
    for offset in offsets:
        if data[offset + 15] != TYPE_INT_BOOLEAN:
            return False
        struct.pack_into("<I", data, offset + 16, packed)
    return True


def read_boolean_attribute(data: bytes, pool: StringPool, attr_name: str) -> bool | None:
    offsets = attribute_offsets(data, pool, attr_name)
    if not offsets:
        return None
    values: list[bool] = []
    for offset in offsets:
        if data[offset + 15] != TYPE_INT_BOOLEAN:
            return None
        values.append(struct.unpack_from("<I", data, offset + 16)[0] != 0)
    if any(values):
        return True
    return False


def read_version_code(data: bytes, pool: StringPool) -> int | None:
    offsets = attribute_offsets(data, pool, "versionCode")
    if not offsets:
        return None
    offset = offsets[0]
    if data[offset + 15] != TYPE_INT_DEC:
        return None
    return struct.unpack_from("<I", data, offset + 16)[0]


def read_version_name(data: bytes, pool: StringPool) -> str | None:
    offsets = attribute_offsets(data, pool, "versionName")
    if not offsets:
        return None
    offset = offsets[0]
    if data[offset + 15] != TYPE_STRING:
        return None
    index = struct.unpack_from("<I", data, offset + 16)[0]
    if index >= pool.string_count:
        return None
    return pool.decode(index)


def load_manifest_bytes(path: str) -> bytes:
    if path.endswith(".apk"):
        import zipfile

        with zipfile.ZipFile(path) as archive:
            return archive.read("AndroidManifest.xml")
    with open(path, "rb") as handle:
        return handle.read()


def verify_release_flags(path: str) -> int:
    data = load_manifest_bytes(path)
    pool = StringPool(data, 8)
    debuggable = read_boolean_attribute(data, pool, "debuggable")
    allow_backup = read_boolean_attribute(data, pool, "allowBackup")
    version_name = read_version_name(data, pool)
    version_code = read_version_code(data, pool)
    if debuggable is not False or allow_backup is not False:
        print(
            "Manifiesto de release inválido: debuggable=%s allowBackup=%s" % (debuggable, allow_backup),
            file=sys.stderr,
        )
        return 1
    print(
        "Manifiesto de release: debuggable=false allowBackup=false versionName=%s versionCode=%s"
        % (version_name or "?", version_code if version_code is not None else "?")
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", nargs="?", help="AndroidManifest.xml binario de entrada")
    parser.add_argument("output", nargs="?", help="ruta del manifiesto resultante")
    parser.add_argument("--old-version-name")
    parser.add_argument("--version-name")
    parser.add_argument("--version-code", type=int)
    parser.add_argument(
        "--verify",
        metavar="APK_O_MANIFIESTO",
        help="comprueba debuggable=false y allowBackup=false y termina",
    )
    args = parser.parse_args()

    if args.verify:
        return verify_release_flags(args.verify)

    if not args.manifest or not args.output or not args.old_version_name or not args.version_name or args.version_code is None:
        parser.error("hacen falta manifest, output, --old-version-name, --version-name y --version-code")

    with open(args.manifest, "rb") as handle:
        data = bytearray(handle.read())

    pool = StringPool(bytes(data), 8)
    index = pool.find(args.old_version_name)
    if index < 0:
        print("No se encontro la versión '%s' en el manifiesto" % args.old_version_name, file=sys.stderr)
        return 1

    if not patch_version_code(data, pool, args.version_code):
        print("No se pudo ajustar versionCode", file=sys.stderr)
        return 1

    if not patch_boolean_attribute(data, pool, "debuggable", False):
        print("No se pudo poner android:debuggable=false", file=sys.stderr)
        return 1

    if not patch_boolean_attribute(data, pool, "allowBackup", False):
        print("No se pudo poner android:allowBackup=false", file=sys.stderr)
        return 1

    new_pool = pool.replace(index, args.version_name)
    patched = bytearray(data[:8] + new_pool + data[pool.start + pool.size :])
    struct.pack_into("<I", patched, 4, len(patched))

    with open(args.output, "wb") as handle:
        handle.write(patched)

    if verify_release_flags(args.output) != 0:
        return 1

    print(
        "Manifiesto actualizado: versionName %s -> %s, versionCode %d, debuggable=false, allowBackup=false"
        % (args.old_version_name, args.version_name, args.version_code)
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
