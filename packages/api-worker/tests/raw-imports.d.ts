// Vite's `?raw` suffix imports a fixture file's text (e.g. a saved upstream HTML page). Kept in its
// Own import-free file so the wildcard declaration is ambient rather than a module augmentation.
declare module '*?raw' {
    const content: string
    export default content
}
