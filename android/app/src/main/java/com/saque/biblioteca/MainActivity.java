package com.saque.biblioteca;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * App-casca que abre a biblioteca (PWA) em uma WebView em tela cheia.
 * O conteúdo vem do site publicado, então o app se atualiza sozinho.
 */
public class MainActivity extends Activity {

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_CODE = 1001;
    private static final String APP_URL = "https://saque1211.github.io/Biblioteca/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);      // localStorage
        settings.setDatabaseEnabled(true);        // IndexedDB
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Ponte para o site baixar arquivos (exportar Excel/JSON) — a WebView
        // sozinha não baixa blobs
        webView.addJavascriptInterface(new Downloader(), "AndroidDownloader");

        webView.setWebViewClient(new WebViewClient());

        // Downloads iniciados diretamente pela página (links http/data)
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            if (url.startsWith("data:")) {
                int comma = url.indexOf(',');
                String meta = url.substring(0, comma);
                byte[] bytes = Base64.decode(url.substring(comma + 1), Base64.DEFAULT);
                String ext = meta.contains("json") ? ".json" : meta.contains("sheet") ? ".xlsx" : ".txt";
                writeToDownloads(bytes, "biblioteca-" + System.currentTimeMillis() + ext, mimetype);
            } else if (url.startsWith("http")) {
                try {
                    DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                    req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,
                            URLUtilGuessName(url, contentDisposition, mimetype));
                    DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    dm.enqueue(req);
                    toast("Baixando…");
                } catch (Exception e) {
                    toast("Não foi possível baixar");
                }
            }
        });

        // Campos de arquivo (importar planilha, escanear/escolher capa):
        // mostra o seletor do Android com Drive, OneDrive, Meus arquivos, etc.
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;

                boolean imageOnly = false;
                String[] accept = params != null ? params.getAcceptTypes() : null;
                if (accept != null) {
                    for (String a : accept) {
                        if (a != null && a.startsWith("image/")) imageOnly = true;
                    }
                }

                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(imageOnly ? "image/*" : "*/*");
                try {
                    startActivityForResult(intent, FILE_CHOOSER_CODE);
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        }
    }

    /** Nome de arquivo simples a partir da URL. */
    private static String URLUtilGuessName(String url, String contentDisposition, String mimetype) {
        try {
            String name = android.webkit.URLUtil.guessFileName(url, contentDisposition, mimetype);
            return name != null ? name : "download";
        } catch (Exception e) {
            return "download";
        }
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    /** Salva bytes na pasta Downloads (MediaStore no Android 10+, sem permissão). */
    private void writeToDownloads(byte[] bytes, String filename, String mime) {
        if (mime == null || mime.isEmpty()) mime = "application/octet-stream";
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                values.put(MediaStore.Downloads.MIME_TYPE, mime);
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                ContentResolver resolver = getContentResolver();
                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new Exception("uri nulo");
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    out.write(bytes);
                }
                values.clear();
                values.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                toast("Salvo em Downloads: " + filename);
            } else {
                File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                File f = new File(dir, filename);
                try (FileOutputStream out = new FileOutputStream(f)) {
                    out.write(bytes);
                }
                toast("Salvo em: " + f.getAbsolutePath());
            }
        } catch (Exception e) {
            toast("Falha ao salvar o arquivo");
        }
    }

    /** Interface chamada pelo JavaScript do site para baixar arquivos. */
    private class Downloader {
        @JavascriptInterface
        public void saveBase64(String dataUrl, String filename, String mime) {
            try {
                String b64 = dataUrl;
                int comma = b64.indexOf(',');
                if (b64.startsWith("data:") && comma >= 0) b64 = b64.substring(comma + 1);
                final byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                runOnUiThread(() -> writeToDownloads(bytes, filename, mime));
            } catch (Exception e) {
                runOnUiThread(() -> toast("Falha ao baixar"));
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_CODE) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                result = new Uri[]{ data.getData() };
            }
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(result);
                filePathCallback = null;
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onRestoreInstanceState(Bundle savedInstanceState) {
        super.onRestoreInstanceState(savedInstanceState);
        webView.restoreState(savedInstanceState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
