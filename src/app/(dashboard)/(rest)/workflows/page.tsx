import { requireAuth } from "@/lib/auth-utils";

const Page = async() => {
    await requireAuth();
    return(
        <p>Workflows</p>
    );
};

export default Page;