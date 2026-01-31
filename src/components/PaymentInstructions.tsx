import { BankAccount } from '../lib/supabase';

interface PaymentInstructionsProps {
    bankAccounts: BankAccount[];
}

export const PaymentInstructions = ({ bankAccounts }: PaymentInstructionsProps) => {
    // If no bank accounts, show nothing or placeholder
    if (!bankAccounts || bankAccounts.length === 0) return null;

    // Assuming we want to show all accounts, or maybe just the primary one?
    // Image 2 shows a specific format for one bank account. 
    // "Bank Name (Final Destination Bank) | UOB Serangoon Central"
    // "Bank Address | No.23 Serangoon Central..."
    // "Account Number | 123456788"
    // "Swift Code | UOV..."
    // "Bank Key/Branch | 65432..."
    // "PayNow UEN | 202244240N"

    // Let's use the primary account, or the first one.
    const account = bankAccounts.find(acc => acc.is_primary) || bankAccounts[0];

    return (
        <div className="mt-8">
            <h3 className="font-bold underline mb-2">Payment Instructions</h3>
            <div className="border border-black text-sm">
                <div className="flex border-b border-black">
                    <div className="w-1/3 p-1 border-r border-black font-semibold">Bank Name (Final Destination Bank)</div>
                    <div className="w-2/3 p-1">{account.bank_name || '-'}</div>
                </div>
                <div className="flex border-b border-black">
                    <div className="w-1/3 p-1 border-r border-black font-semibold">Bank Address</div>
                    <div className="w-2/3 p-1">{account.bank_address || '-'}</div>
                </div>
                <div className="flex border-b border-black">
                    <div className="w-1/3 p-1 border-r border-black font-semibold">Account Number</div>
                    <div className="w-2/3 p-1">{account.account_number || '-'}</div>
                </div>
                <div className="flex border-b border-black">
                    <div className="w-1/3 p-1 border-r border-black font-semibold">Swift Code (Non-US Bank)</div>
                    <div className="w-2/3 p-1">{account.swift_code || '-'}</div>
                </div>
                <div className="flex border-b border-black">
                    <div className="w-1/3 p-1 border-r border-black font-semibold">Bank Key/Branch Code</div>
                    <div className="w-2/3 p-1">{account.branch_code || '-'}</div>
                </div>
                <div className="flex">
                    <div className="w-1/3 p-1 border-r border-black font-semibold">PayNow UEN</div>
                    <div className="w-2/3 p-1">{account.paynow_uen || '-'}</div>
                </div>
            </div>
        </div>
    );
};
