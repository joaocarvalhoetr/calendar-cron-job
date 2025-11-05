// Cache compartilhado para o conteúdo do arquivo .ics
let cachedICS: string | null = null;
let lastUpdate: number = 0;

export function setICSCache(icsContent: string): void {
    cachedICS = icsContent;
    lastUpdate = Date.now();
}

export function getICSCache(): string | null {
    return cachedICS;
}

export function getLastUpdate(): number {
    return lastUpdate;
}

export function clearCache(): void {
    cachedICS = null;
    lastUpdate = 0;
}

