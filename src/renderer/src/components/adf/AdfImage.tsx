import { useState, useEffect } from "react"
import { ZoomIn } from "lucide-react"
import { ImageLightbox } from "../shared/ImageLightbox"

interface Props {
    contentUrl: string
}

export function AdfImage({ contentUrl }: Props) {
    const [dataUrl, setDataUrl] = useState<string | null>(null)
    const [lightbox, setLightbox] = useState(false)

    useEffect(() => {
        setDataUrl(null)
        window.api
            .fetchMedia(contentUrl)
            .then((r) => {
                if (r) setDataUrl(r)
            })
            .catch(() => {})
    }, [contentUrl])

    if (!dataUrl) return null

    return (
        <>
            <div className="relative group inline-block my-2 cursor-zoom-in" onClick={() => setLightbox(true)}>
                <img
                    src={dataUrl}
                    alt=""
                    className="rounded border border-gray-700/50 max-w-full block"
                    style={{ maxHeight: 280, objectFit: "contain" }}
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded">
                    <ZoomIn className="w-6 h-6 text-white drop-shadow" />
                </div>
            </div>
            {lightbox && <ImageLightbox src={dataUrl} onClose={() => setLightbox(false)} />}
        </>
    )
}
