// Keep the generated USDZ alive while iOS hands it to Quick Look.
// Opening requires a fresh tap after asynchronous conversion has completed.
class QRIEQuickLook {
    constructor({ viewer, button, scaleControl, status, fetchFile = fetch, revoke = URL.revokeObjectURL.bind(URL) }) {
        Object.assign(this, { viewer, button, scaleControl, status, fetchFile, revoke });
        this.url = null;
        this.readyKey = null;
        this.epoch = 0;
        this.busy = false;
        this.anchor = document.createElement("a");
        this.anchor.rel = "ar";
        this.anchor.hidden = true;
        this.anchor.append(document.createElement("img"));
        document.body.append(this.anchor);
    }
    invalidate() {
        this.epoch++;
        this.readyKey = null;
        if (!this.busy) this.button.textContent = "ARで見る";
        this.status.textContent = "";
    }
    async open(scale) {
        if (this.busy) return;
        const key = `${this.epoch}:${scale}`;
        if (this.readyKey === key && this.url) {
            // No await before the native handoff: preserve this user gesture.
            this.anchor.href = `${this.url}#allowsContentScaling=0`;
            this.anchor.click();
            return;
        }
        this.busy = true;
        this.button.disabled = true;
        this.scaleControl.disabled = true;
        this.button.textContent = "ARを準備中…";
        this.status.textContent = "ARの準備ができるまでお待ちください。";
        let candidate = null;
        try {
            this.viewer.scale = [scale, scale, scale].join(" ");
            await this.viewer.updateComplete;
            candidate = await this.viewer.prepareUSDZ();
            if (!candidate?.startsWith("blob:")) throw new Error("USDZ export returned no blob URL");
            const response = await this.fetchFile(candidate);
            if (!response.ok) throw new Error("USDZ blob unavailable");
            const file = await response.blob();
            const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
            if (file.size < 22 || signature[0] !== 0x50 || signature[1] !== 0x4b || signature[2] !== 3 || signature[3] !== 4) {
                throw new Error("USDZ export is empty or is not a ZIP package");
            }
            if (key !== `${this.epoch}:${scale}`) {
                this.status.textContent = "設定が変更されました。もう一度ARボタンを押してください。";
                return;
            }
            const previous = this.url;
            this.url = candidate;
            candidate = null;
            this.readyKey = key;
            if (previous) this.revoke(previous);
            console.info("QRIE USDZ ready:", { bytes: file.size });
            this.button.textContent = "ARを開く";
            this.status.textContent = "準備ができました。「ARを開く」をタップしてください。";
        } catch (error) {
            console.error("QRIE Quick Look preparation failed:", error);
            this.readyKey = null;
            this.status.textContent = "ARの準備に失敗しました。ページを再読み込みしてお試しください。";
        } finally {
            if (candidate) this.revoke(candidate);
            this.viewer.scale = "1 1 1";
            this.busy = false;
            this.button.disabled = false;
            this.scaleControl.disabled = false;
            if (!this.readyKey) this.button.textContent = "ARで見る";
        }
    }
}
