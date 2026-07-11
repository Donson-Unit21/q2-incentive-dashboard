(function () {
  const buildVersion = "ba55293";
  const workerSource = `
    async function readTextFromGzip(url) {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("gzip data " + res.status);
      if (!("DecompressionStream" in self)) throw new Error("gzip decompression unsupported");
      const stream = res.body.pipeThrough(new DecompressionStream("gzip"));
      return await new Response(stream).text();
    }

    async function readTextFromScript(url) {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("script data " + res.status);
      const text = await res.text();
      return text
        .replace(/^\\s*window\\.PERFORMANCE_DATA\\s*=\\s*/, "")
        .replace(/;\\s*$/, "");
    }

    self.onmessage = async event => {
      const version = event.data.version;
      const baseUrl = event.data.baseUrl;
      try {
        let text;
        try {
          text = await readTextFromGzip(new URL("./data.json.gz?v=" + version, baseUrl).href);
        } catch (gzipError) {
          text = await readTextFromScript(new URL("./data.js?v=" + version, baseUrl).href);
        }
        self.postMessage({ ok: true, data: JSON.parse(text) });
      } catch (error) {
        self.postMessage({ ok: false, message: error && error.message ? error.message : String(error) });
      }
    };
  `;

  function bootApp() {
    const script = document.createElement("script");
    script.src = "./app.js?v=" + buildVersion;
    document.body.appendChild(script);
  }

  function showLoadError(message) {
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;inset:24px;z-index:99999;display:grid;place-items:center;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#12213f;background:rgba(245,247,252,.96);";
    box.innerHTML = "<div style='max-width:560px;padding:24px;border:1px solid #dbe4f3;border-radius:12px;background:#fff;box-shadow:0 18px 50px rgba(15,35,80,.12)'><b>数据加载失败</b><p>请刷新页面重试；如果仍然失败，把这段信息发给管理员：</p><code style='word-break:break-all'>" + String(message || "unknown") + "</code></div>";
    document.body.appendChild(box);
  }

  const blob = new Blob([workerSource], { type: "text/javascript" });
  const worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = event => {
    if (!event.data || !event.data.ok) {
      showLoadError(event.data && event.data.message);
      return;
    }
    window.PERFORMANCE_DATA = event.data.data;
    bootApp();
  };
  worker.postMessage({ version: buildVersion, baseUrl: window.location.href });
})();
