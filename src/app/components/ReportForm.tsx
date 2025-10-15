"use client";

import React, { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";


type ApiResponse = {
    success: boolean;
    message?: string;
    trelloUrl?: string;
};

export default function ReportForm() {
    const [reportText, setReportText] = useState("");
    const [machineId, setMachineId] = useState("");
    const [photo, setPhoto] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [trelloUrl, setTrelloUrl] = useState<string | null>(null);
    const router = useRouter();

    const validate = () => {
        if (!reportText.trim()) {
            setError("Please describe the issue in the report field.");
            return false;
        }
        if (photo && photo.size > 5 * 1024 * 1024) {
            setError("Photo is too large. Max size: 5 MB.");
            return false;
        }
        return true;
    };

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);
        setTrelloUrl(null);

        if (!validate()) return;

        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append("report", reportText.trim());
            if (machineId.trim()) formData.append("machineId", machineId.trim());
            if (photo) formData.append("photo", photo);

            const res = await fetch("/api/triage", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Server responded ${res.status}`);
            }

            const data: ApiResponse = await res.json();

            if (!data.success) {
                throw new Error(data.message || "Triage failed on the server.");
            }

            setSuccessMsg(data.message ?? "Ticket dispatched successfully.");
            if (data.trelloUrl) setTrelloUrl(data.trelloUrl);

            // Clear form
            setReportText("");
            setMachineId("");
            setPhoto(null);
        } catch (err: any) {
            console.error("Submit error:", err);
            setError(err.message ?? "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-4 bg-card-light dark:bg-card-dark rounded-2xl shadow-card">
            <h2 className="text-xl font-semibold mb-3">Submit Field Report</h2>
            <p className="text-sm mb-4 text-gray-600 dark:text-gray-300">
                Describe the issue in your own words. The system will automatically triage and dispatch a ticket.
            </p>

            <form onSubmit={onSubmit} className="space-y-4" aria-describedby="form-help">
                <div>
                    <label htmlFor="report" className="block text-sm font-medium mb-1">
                        Report (required)
                    </label>
                    <textarea
                        id="report"
                        value={reportText}
                        onChange={(e) => setReportText(e.target.value)}
                        rows={6}
                        placeholder='Example: "Machine 4 made a grinding noise, then shut down after the shift started."'
                        className="w-full rounded-lg border px-3 py-2 resize-vertical min-h-[120px] focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                        aria-required
                    />
                </div>

                <div>
                    <label htmlFor="machineId" className="block text-sm font-medium mb-1">
                        Machine ID (optional)
                    </label>
                    <input
                        id="machineId"
                        value={machineId}
                        onChange={(e) => setMachineId(e.target.value)}
                        placeholder="e.g., Machine 4, Line A - Press #12"
                        className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                <div>
                    <label htmlFor="photo" className="block text-sm font-medium mb-1">
                        Photo (optional, max 5MB)
                    </label>
                    <input
                        id="photo"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                        className="block text-sm"
                    />
                    {photo && (
                        <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                            Selected file: <span className="font-medium">{photo.name}</span> ({Math.round(photo.size / 1024)} KB)
                        </div>
                    )}
                </div>

                <div id="form-help" className="text-xs text-gray-500 dark:text-gray-400">
                    Tip: Keep the description factual (what happened, when, any noises, smell, visible damage).
                </div>

                <div className="flex items-center space-x-3 pt-2">
                    <button
                        type="submit"
                        className="inline-flex items-center px-4 py-2 rounded-lg bg-primary cursor-pointer font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <svg
                                    className="animate-spin -ml-1 mr-2 h-5 w-5"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                Sending...
                            </>
                        ) : (
                            "Send Report"
                        )}
                    </button>

                    <button
                        type="button"
                        className="px-3 py-2 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
                        onClick={() => {
                            setReportText("");
                            setMachineId("");
                            setPhoto(null);
                            setError(null);
                            setSuccessMsg(null);
                            setTrelloUrl(null);
                        }}
                        disabled={isLoading}
                    >
                        Reset
                    </button>
                </div>

                {error && <div role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

                {successMsg && (
                    <div role="status" className="mt-3 text-sm text-green-700 dark:text-green-300">
                        {successMsg}
                        {trelloUrl && (
                            <div className="mt-2">
                                <a href={trelloUrl} target="_blank" rel="noreferrer" className="underline font-medium">
                                    View Trello Card
                                </a>
                            </div>
                        )}
                    </div>
                )}
            </form>
            <button onClick={()=>{router.push("/reports")}} className="px-3 py-2 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">Reports</button>
        </div>
    );
}
