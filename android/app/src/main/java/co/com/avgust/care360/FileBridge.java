package co.com.avgust.care360;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Android WebView ignores the download attribute of an anchor, so Word, Excel
 * and CSV exports are streamed here in base64 chunks and handed to the system
 * share sheet. Reports carry field photographs, so the transfer is chunked
 * instead of passed as a single string.
 */
public class FileBridge {

    private static final long MAX_BYTES = 768L * 1024 * 1024;
    private static final long KEEP_MILLIS = 6L * 60 * 60 * 1000;
    private static final String DIRECTORY = "exports";
    private static final String STORE = "care360.sqlite";

    private final Activity activity;
    private final Map<String, Transfer> transfers = new HashMap<>();
    private FileOutputStream storeOut;

    FileBridge(Activity activity) {
        this.activity = activity;
    }

    private static final class Transfer {

        private final File file;
        private final FileOutputStream stream;
        private final String mime;
        private long written;

        private Transfer(File file, FileOutputStream stream, String mime) {
            this.file = file;
            this.stream = stream;
            this.mime = mime;
        }
    }

    @JavascriptInterface
    public String begin(String name, String mime) {
        try {
            File directory = exportDirectory();
            purge(directory);
            File file = new File(directory, safeName(name));
            Transfer transfer = new Transfer(file, new FileOutputStream(file), safeMime(mime));
            String token = UUID.randomUUID().toString();
            synchronized (transfers) {
                transfers.put(token, transfer);
            }
            return token;
        } catch (IOException error) {
            return "";
        }
    }

    @JavascriptInterface
    public boolean append(String token, String chunk) {
        Transfer transfer = peek(token);
        if (transfer == null) return false;
        try {
            byte[] bytes = Base64.decode(chunk, Base64.DEFAULT);
            transfer.written += bytes.length;
            if (transfer.written > MAX_BYTES) {
                abort(token);
                return false;
            }
            transfer.stream.write(bytes);
            return true;
        } catch (IOException | IllegalArgumentException error) {
            abort(token);
            return false;
        }
    }

    @JavascriptInterface
    public boolean finish(String token) {
        Transfer transfer = take(token);
        if (transfer == null) return false;
        try {
            transfer.stream.close();
        } catch (IOException error) {
            transfer.file.delete();
            return false;
        }
        Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", transfer.file);
        Intent send = new Intent(Intent.ACTION_SEND)
            .setType(transfer.mime)
            .putExtra(Intent.EXTRA_STREAM, uri)
            .putExtra(Intent.EXTRA_SUBJECT, transfer.file.getName())
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        send.setClipData(ClipData.newRawUri(transfer.file.getName(), uri));
        Intent chooser = Intent.createChooser(send, "Guardar o compartir");
        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        activity.runOnUiThread(() -> {
            try {
                activity.startActivity(chooser);
            } catch (ActivityNotFoundException error) {
                Toast.makeText(activity, "No hay una aplicación para guardar o compartir el archivo.", Toast.LENGTH_LONG).show();
            }
        });
        return true;
    }

    @JavascriptInterface
    public int storeLength() {
        File file = storeFile();
        return file.isFile() ? (int) Math.min(file.length(), Integer.MAX_VALUE) : 0;
    }

    @JavascriptInterface
    public String storeSlice(int offset, int length) {
        File file = storeFile();
        if (!file.isFile() || offset < 0 || length <= 0 || offset >= file.length()) return "";
        int take = (int) Math.min(length, file.length() - offset);
        byte[] bytes = new byte[take];
        try (java.io.FileInputStream input = new java.io.FileInputStream(file)) {
            if (input.skip(offset) < offset) return "";
            int read = input.read(bytes);
            if (read <= 0) return "";
            if (read < bytes.length) {
                byte[] slice = new byte[read];
                System.arraycopy(bytes, 0, slice, 0, read);
                bytes = slice;
            }
            return Base64.encodeToString(bytes, Base64.NO_WRAP);
        } catch (IOException error) {
            return "";
        }
    }

    @JavascriptInterface
    public boolean storeStart() {
        try {
            closeStoreOut();
            storeOut = new FileOutputStream(storeTemp());
            return true;
        } catch (IOException error) {
            return false;
        }
    }

    @JavascriptInterface
    public boolean storeAppend(String chunk) {
        if (storeOut == null) return false;
        try {
            byte[] bytes = Base64.decode(chunk, Base64.DEFAULT);
            storeOut.write(bytes);
            return true;
        } catch (IOException | IllegalArgumentException error) {
            closeStoreOut();
            storeTemp().delete();
            return false;
        }
    }

    @JavascriptInterface
    public boolean storeCommit() {
        if (storeOut == null) return false;
        try {
            storeOut.close();
            storeOut = null;
            File temp = storeTemp();
            File file = storeFile();
            if (file.exists() && !file.delete()) return false;
            return temp.renameTo(file);
        } catch (IOException error) {
            return false;
        }
    }

    private File storeFile() {
        return new File(activity.getFilesDir(), STORE);
    }

    private File storeTemp() {
        return new File(activity.getFilesDir(), STORE + ".tmp");
    }

    private void closeStoreOut() {
        if (storeOut == null) return;
        try {
            storeOut.close();
        } catch (IOException ignored) {
            // The next write replaces the temporary file.
        }
        storeOut = null;
    }

    @JavascriptInterface
    public void abort(String token) {
        Transfer transfer = take(token);
        if (transfer == null) return;
        try {
            transfer.stream.close();
        } catch (IOException ignored) {
            // The partial file is discarded either way.
        }
        transfer.file.delete();
    }

    private Transfer peek(String token) {
        synchronized (transfers) {
            return transfers.get(token);
        }
    }

    private Transfer take(String token) {
        synchronized (transfers) {
            return transfers.remove(token);
        }
    }

    private File exportDirectory() throws IOException {
        File base = activity.getExternalFilesDir(null);
        if (base == null) base = activity.getFilesDir();
        File directory = new File(base, DIRECTORY);
        if (!directory.isDirectory() && !directory.mkdirs()) {
            throw new IOException("No export directory available.");
        }
        return directory;
    }

    private void purge(File directory) {
        File[] files = directory.listFiles();
        if (files == null) return;
        long limit = System.currentTimeMillis() - KEEP_MILLIS;
        for (File file : files) {
            if (file.isFile() && file.lastModified() < limit) file.delete();
        }
    }

    private static String safeName(String name) {
        String candidate = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "-").trim();
        if (candidate.isEmpty()) candidate = "AVGUST CARE 360.bin";
        return candidate.length() > 120 ? candidate.substring(candidate.length() - 120) : candidate;
    }

    private static String safeMime(String mime) {
        return mime == null || mime.isEmpty() || mime.indexOf('/') < 0 ? "application/octet-stream" : mime;
    }
}
