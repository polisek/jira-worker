import { useState, useCallback, useEffect, useRef } from 'react'

export type TaskDetailControllerProps = {
    /** Issues visited via forward navigation (excluding root issueKey) */
    navHistory: string[]
    /** Currently displayed issue key */
    currentKey: string
    panelWidth: number
    onResizeMouseDown: (e: React.MouseEvent) => void
    handleNavigateTo: (key: string) => void
    /** Navigate back to a position in navHistory (0-indexed into navHistory array) */
    handleBreadcrumbNav: (index: number) => void
    /** Navigate back to root issueKey */
    handleBreadcrumbRoot: () => void
}

const useTaskDetailController = (issueKey: string): TaskDetailControllerProps => {
    const [navHistory, setNavHistory] = useState<string[]>([])
    const [panelWidth, setPanelWidth] = useState(480)
    const dragStartX = useRef<number | null>(null)
    const dragStartWidth = useRef<number>(480)

    // Reset navigation when root issue changes
    useEffect(() => {
        setNavHistory([])
    }, [issueKey])

    const currentKey = navHistory.length > 0 ? navHistory[navHistory.length - 1] : issueKey

    const onResizeMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault()
            dragStartX.current = e.clientX
            dragStartWidth.current = panelWidth

            const onMouseMove = (ev: MouseEvent) => {
                if (dragStartX.current === null) return
                const delta = dragStartX.current - ev.clientX
                setPanelWidth(Math.max(400, dragStartWidth.current + delta))
            }
            const onMouseUp = () => {
                dragStartX.current = null
                window.removeEventListener('mousemove', onMouseMove)
                window.removeEventListener('mouseup', onMouseUp)
            }
            window.addEventListener('mousemove', onMouseMove)
            window.addEventListener('mouseup', onMouseUp)
        },
        [panelWidth]
    )

    const handleNavigateTo = useCallback((key: string) => {
        setNavHistory((prev) => [...prev, key])
    }, [])

    const handleBreadcrumbNav = useCallback((index: number) => {
        setNavHistory((prev) => prev.slice(0, index + 1))
    }, [])

    const handleBreadcrumbRoot = useCallback(() => {
        setNavHistory([])
    }, [])

    return {
        navHistory,
        currentKey,
        panelWidth,
        onResizeMouseDown,
        handleNavigateTo,
        handleBreadcrumbNav,
        handleBreadcrumbRoot,
    }
}

export default useTaskDetailController
