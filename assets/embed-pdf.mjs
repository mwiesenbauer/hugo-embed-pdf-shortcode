async function findEmbedPdfContainers() {
    // Loaded via <script> tag, create shortcut to access PDF.js exports.
    const {pdfjsLib} = globalThis;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.run/pdfjs-dist/build/pdf.worker.mjs';

    const matches = document.querySelectorAll("div[data-document-url]");
    for (let match of matches) {
        const url = match.dataset.documentUrl;
        const loadingTask = pdfjsLib.getDocument(url);
        const pdfDocument = await loadingTask.promise;
        const urlHash = match.dataset.documentUrlHash;

        const hidePaginator = match.dataset.hidePaginator === "true";
        const hideLoader = match.dataset.hideLoader === "true";
        const selectedPageNum = parseInt(match.dataset.renderPageNum) || 1;
        const embedding = new PdfEmbedding(
            pdfDocument,
            urlHash,
            selectedPageNum,
            hidePaginator,
            hideLoader
        );

        // Attempt to show paginator and loader if enabled
        embedding.showPaginator();
        embedding.showLoader();
        await embedding.renderPage(selectedPageNum);
    }
}

class PdfEmbedding {
    urlHash;
    hidePaginator;
    hideLoader;
    canvas;
    pageRendering;
    pageNumPending = null;
    paginator;
    scale = 3;
    #pageNum = 1;
    pdfDoc;

    constructor(
        pdfDoc,
        urlHash,
        selectedPageNum,
        hidePaginator,
        hideLoader
    ) {
        // Change the Scale value for lower or higher resolution.
        this.paginator = document.querySelector(`#pdf-paginator-${urlHash}`);
        this.loadingWrapper = document.querySelector(`#pdf-loadingWrapper-${urlHash}`);
        this.canvas = document.querySelector(`#pdf-canvas-${urlHash}`);
        this.pageRendering = false;
        this.hidePaginator = hidePaginator;
        this.hideLoader = hideLoader;
        this.#pageNum = selectedPageNum;
        this.pdfDoc = pdfDoc;
        this.urlHash = urlHash;

        const numPages = pdfDoc.numPages;
        const pageCountElement = document.getElementById(`pdf-pagecount-${urlHash}`);
        pageCountElement.textContent = numPages;

        // If the user passed in a number that is out of range, render the last page.
        if (this.#pageNum > numPages) {
            this.#pageNum = numPages
        }

        document
            .getElementById(`pdf-prev-${urlHash}`)
            .addEventListener('click', this.onPrevPage);
        document
            .getElementById(`pdf-next-${urlHash}`)
            .addEventListener('click', this.onNextPage);
    }

    /**
     * Get page info from document, resize canvas accordingly, and render page.
     * @param num Page number.
     */
    async renderPage(num) {
        this.pageRendering = true;
        // Using promise to fetch the page
        const ctx = this.canvas.getContext('2d');
        const page = await this.pdfDoc.getPage(num);
        const viewport = page.getViewport({scale: this.scale});
        this.canvas.height = viewport.height;
        this.canvas.width = viewport.width;

        // Render PDF page into canvas context
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        const renderTask = page.render(renderContext);

        // Wait for rendering to finish
        await renderTask.promise;
        this.pageRendering = false;
        this.showContent();

        if (this.pageNumPending !== null) {
            // New page rendering is pending
            await this.renderPage(this.pageNumPending);
            this.pageNumPending = null;
        }

        // Update page counters
        document.getElementById(`pdf-pagenum-${this.urlHash}`).textContent = num;
    }

    /**
     * Hides loader and shows canvas
     */
    showContent() {
        this.loadingWrapper.style.display = 'none';
        this.canvas.style.display = 'block';
    }

    /**
     * If we haven't disabled the loader, show loader and hide canvas
     */
    showLoader() {
        if (this.hideLoader) {
            return;
        }

        this.loadingWrapper.style.display = 'flex';
        this.canvas.style.display = 'none';
    }

    /**
     * If we haven't disabled the paginator, show paginator
     */
    showPaginator() {
        if (this.hidePaginator) {
            return;
        }
        this.paginator.style.display = 'block';
    }

    /**
     * If another page rendering in progress, waits until the rendering is
     * finished. Otherwise, executes rendering immediately.
     */
    async queueRenderPage(num) {
        if (this.pageRendering) {
            this.pageNumPending = num;
        } else {
            await this.renderPage(num);
        }
    }

    /**
     * Displays previous page.
     */
    onPrevPage = async (e) => {
        if (this.#pageNum <= 1) {
            return;
        }
        this.#pageNum--;
        await this.queueRenderPage(this.#pageNum);
    }

    /**
     * Displays next page.
     */
    onNextPage = async (e) => {
        if (this.#pageNum >= this.pdfDoc.numPages) {
            return;
        }
        this.#pageNum++;
        await this.queueRenderPage(this.#pageNum);
    }
}

export default await findEmbedPdfContainers();