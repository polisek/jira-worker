import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60, // 1 minute
            retry: 1,
        },
    },
})

const AppQueryProvider = ({ children }: React.PropsWithChildren<unknown>): JSX.Element => {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
        </QueryClientProvider>
    )
}

export default AppQueryProvider
