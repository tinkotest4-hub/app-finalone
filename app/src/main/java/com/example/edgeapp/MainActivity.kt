package com.example.edgeapp

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main1)

        val webView: WebView = findViewById(R.id.webview)

        // --- Critical settings for offline HTML + localStorage ---
        val s: WebSettings = webView.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true           // enable localStorage/sessionStorage
        s.databaseEnabled = true
        s.allowFileAccess = true
        s.allowContentAccess = true
        s.allowFileAccessFromFileURLs = true // allow local pages to load local assets
        s.allowUniversalAccessFromFileURLs = true
        s.cacheMode = WebSettings.LOAD_DEFAULT
        s.builtInZoomControls = false
        s.displayZoomControls = false
        s.loadsImagesAutomatically = true
        s.mediaPlaybackRequiresUserGesture = false
        // If you use mixed http/https assets inside file:// pages:
        // s.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        // Keep navigation inside the WebView
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                view.loadUrl(url)
                return true
            }
        }

        // Needed for JS alert(), confirm(), prompt(), console.log
        webView.webChromeClient = WebChromeClient()

        // Load your first page from assets
        webView.loadUrl("file:///android_asset/welcome.html")
    }

    override fun onBackPressed() {
        val webView: WebView = findViewById(R.id.webview)
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
