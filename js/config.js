const BASE_PATH =
window.location.hostname === "egmceiryu.github.io"
    ? "/ar_housing"
    : "";

const VIEWER_URL =
`${window.location.origin}${BASE_PATH}/ar.html`;

function getViewerUrl(slug, color) {
    const url = new URL(VIEWER_URL);
    url.searchParams.set("slug", slug);
    if (color) url.searchParams.set("color", color);
    return url.href;
}