"use client"

import { AlertDialog, AlertDialogAction, AlertDialogCancel ,AlertDialogContent, AlertDialogDescription, AlertDialogFooter , AlertDialogHeader , AlertDialogTitle} from "@/components/ui/alert-dialog"
import { authClient } from "@/lib/auth-client"

interface UpgradeModalProps {
    open:boolean;
    onOpenChange: (open:boolean) => void
}

export const UpgradeModal = ({ open,onOpenChange }: UpgradeModalProps) =>{
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Upgrade to Pro</AlertDialogTitle>
                    <AlertDialogDescription>
                        You need an active subscription to perform this action. Upgrade to Pro to unlock all features 
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    
                    <AlertDialogCancel onClick={()=> authClient.checkout({slug:"pro" }) } className="bg-orange-500 text-white hover:bg-orange-600 hover:text-white" >Upgrade Now</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}