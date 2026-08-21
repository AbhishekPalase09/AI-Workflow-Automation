import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export const useSubscription = () => {
    return useQuery({
        queryKey: ["subscription"],
        queryFn: async () => {
            const { data } = await authClient.customer.state();
            console.log("data: ", data);
            return data;
        },
    });
};

export const useHasActiveSubscription = () => {
    const {
        data: customerState,
        isLoading,
        ...rest
    } = useSubscription();

    console.log("state: ", customerState);
    const hasActiveSubscription =
        (customerState?.activeSubscriptions?.length ?? 0) > 0;

    const hasProAccess =
        hasActiveSubscription || (customerState?.grantedBenefits?.length ?? 0) > 0;

    return {
        hasActiveSubscription,
        hasProAccess,
        subscription: customerState?.activeSubscriptions?.[0],
        customerState,
        isLoading,
        ...rest,
    };
};