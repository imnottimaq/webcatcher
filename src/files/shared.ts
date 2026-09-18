import JSZip from "jszip"

export type ArchiveFileFilter = (relativePath: string) => boolean;

const MAX_ARCHIVE_SIZE = 100 * 1024 * 1024;
const MAX_FILES = 2_000;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_TOTAL_SIZE = 500 * 1024 * 1024;

export async function unpackAndSave(
    file: File,
    where: "skins" | "beatmaps",
    fileFilter?: ArchiveFileFilter,
): Promise<FileSystemDirectoryHandle> {
    const expectedExtension = where === "skins" ? ".osk" : ".osz";
    if (!file.name.toLowerCase().endsWith(expectedExtension)) throw new Error(`Expected ${expectedExtension} file for ${where}`,);
    if (file.size > MAX_ARCHIVE_SIZE) throw new Error("Archive is too large");

    const zip = await JSZip.loadAsync(file)

    const entries = Object.entries(zip.files)
    if (entries.length > MAX_FILES) throw new Error("Archive contains too many files");

    let totalSize = 0;

    const root = await navigator.storage.getDirectory()
    const itemName = file.name.replace(/\.(osz|osk)$/i, "");
    const directory = await root.getDirectoryHandle(where, {create: true})
    const itemDirectory = await directory.getDirectoryHandle(itemName, {create: true})

    for (const [relPath, entry] of entries){
        const parts = parseZipPath(relPath)

        if (parts.length === 0 || entry.dir) continue;

        const relativePath = parts.join("/")
        if (fileFilter && !fileFilter(relativePath)) continue;

        const fileName = parts.pop()!;

        const finalDirectory = await createDirectories(itemDirectory, parts)
        const content = await entry.async('blob');
        if (content.size > MAX_FILE_SIZE) throw new Error("Archive entry is too large: "+relPath);

        totalSize += content.size;
        if (totalSize > MAX_TOTAL_SIZE) throw new Error("Unpacked archive is too large");

        const fileHandle = await finalDirectory.getFileHandle(fileName,{create:true})
        const writable = await fileHandle.createWritable();

        try{
            await writable.write(content);
        } finally {
            await writable.close();
        }
    }

    return itemDirectory;
}

function parseZipPath(path: string): string[] {
    const normalized = path.replaceAll("\\", "/");
    if (normalized.startsWith("/") || /^[a-z]:\//i.test(normalized)) throw new Error(`Unsafe ZIP path: ${path}`);

    const parts = normalized.split("/").filter(Boolean);
    if (parts.includes("..")) throw new Error(`Unsafe ZIP path: ${path}`);

    return parts.filter((part) => part !== ".");
}

async function createDirectories(root: FileSystemDirectoryHandle, parts: string[]): Promise<FileSystemDirectoryHandle> {
    let directory = root;

    for (const part of parts) {
        directory = await directory.getDirectoryHandle(part, {
            create: true,
        });
    }

    return directory;
}

export async function EnumFiles() {
    const root = await navigator.storage.getDirectory()

    const iterate = async (handle: FileSystemDirectoryHandle, depth = 0) => {
        const indent = ' '.repeat(depth * 2);
        for await (const entry of handle.values()){
            if (entry.kind === 'directory') {
                console.log(`${indent}📁 ${entry.name}/`)
                await iterate(entry, depth+1)
            } else console.log(`${indent}📄 ${entry.name}`)
        }
    }

    iterate(root)
}

export async function EnumDir(folder: string): Promise<string[]> {
    const root = await navigator.storage.getDirectory()
    const result: string[] = []

    try {
        const dir = await root.getDirectoryHandle(folder)

        for await (const entry of dir.values()) if (entry.kind === 'directory') result.push(entry.name)
            
    } catch (error) {
        if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error
    }

    return result
}

export async function selectArchiveFile(accept: `.${string}`[], desc: string): Promise<File> {
    if (typeof window.showOpenFilePicker === "function") {
        const [handle] = await window.showOpenFilePicker({
            multiple: false,
            types: [
                {
                    description: desc,
                    accept: {'application/octet-stream': accept}
                },
            ],
        });

        return handle.getFile();
    }

    return new Promise<File>((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept.join(",");
        input.hidden = true;

        function cleanup(): void {
            input.remove();
        }

        input.addEventListener("change", () => {
            const file = input.files?.[0];
            cleanup();

            if (file) resolve(file);
            else reject(new DOMException("File selection cancelled", "AbortError"));
        }, { once: true });

        input.addEventListener("cancel", () => {
            cleanup();
            reject(new DOMException("File selection cancelled", "AbortError"));
        }, { once: true });

        document.body.appendChild(input);
        input.click();
    });
}

