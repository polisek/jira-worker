import { useState, useRef, useEffect, useCallback } from "react"
import { jiraApi } from "../../../utils/jira-api"
import type { JiraUser } from "../../../types/jira"
import { toDateStr } from "../utils"

export type WorkLogViewControllerProps = {
    currentMonth: Date
    myself: JiraUser | null
    selectedUser: JiraUser | null
    userSearch: string
    userResults: JiraUser[]
    userDropdownOpen: boolean
    selectedDay: Date | null
    updatedSince: string
    prevMonth: () => void
    nextMonth: () => void
    setSelectedDay: (day: Date | null) => void
    setUserDropdownOpen: (open: boolean) => void
    handleUserSearch: (q: string) => void
    selectUser: (u: JiraUser) => void
}

const useWorkLogViewController = (): WorkLogViewControllerProps => {
    const today = new Date()
    const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
    const [myself, setMyself] = useState<JiraUser | null>(null)
    const [selectedUser, setSelectedUser] = useState<JiraUser | null>(null)
    const [userSearch, setUserSearch] = useState("")
    const [userResults, setUserResults] = useState<JiraUser[]>([])
    const [userDropdownOpen, setUserDropdownOpen] = useState(false)
    const [selectedDay, setSelectedDay] = useState<Date | null>(null)
    const userSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const updatedSince = toDateStr(new Date(today.getFullYear(), today.getMonth(), 1))

    useEffect(() => {
        jiraApi
            .getMyself()
            .then((u) => {
                setMyself(u)
                setSelectedUser(u)
            })
            .catch(() => {})
    }, [])

    const prevMonth = useCallback(
        () => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)),
        []
    )
    const nextMonth = useCallback(
        () => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)),
        []
    )

    const handleUserSearch = useCallback((q: string) => {
        setUserSearch(q)
        if (userSearchRef.current) clearTimeout(userSearchRef.current)
        if (!q.trim()) {
            setUserResults([])
            return
        }
        userSearchRef.current = setTimeout(async () => {
            try {
                const users = await jiraApi.searchUsers(q)
                setUserResults(users)
            } catch {
                setUserResults([])
            }
        }, 400)
    }, [])

    const selectUser = useCallback((u: JiraUser) => {
        setSelectedUser(u)
        setUserDropdownOpen(false)
        setUserSearch("")
        setUserResults([])
    }, [])

    return {
        currentMonth,
        myself,
        selectedUser,
        userSearch,
        userResults,
        userDropdownOpen,
        selectedDay,
        updatedSince,
        prevMonth,
        nextMonth,
        setSelectedDay,
        setUserDropdownOpen,
        handleUserSearch,
        selectUser,
    }
}

export default useWorkLogViewController
