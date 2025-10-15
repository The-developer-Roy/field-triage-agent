"use client"

import { useEffect, useState } from "react";

interface Report {
    id: string;
    name: string;
    desc: string;
    url: string;
    attachments: string[];
}

export default function ReportsDashboard() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const res = await fetch("/api/reports");
            const data = await res.json();
            if (data.success) setReports(data.data);
            setLoading(false);
        })();
    }, []);

    if (loading) return <p className="text-center mt-10">Loading reports...</p>;

    return (
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((report) => (
                <div key={report.id} className="bg-white rounded-2xl shadow-md p-4 hover:shadow-xl transition">
                    <h2 className="text-lg font-semibold mb-2">{report.name}</h2>
                    <p className="text-sm text-gray-600 mb-3">{report.desc}</p>
                    {report.attachments.length > 0 && (
                        <img
                            src={report.attachments[0]}
                            alt="attachment"
                            className="w-full h-40 object-cover rounded-lg"
                        />
                    )}
                    <a
                        href={report.url}
                        target="_blank"
                        className="block text-blue-600 text-sm mt-3 hover:underline"
                    >
                        View on Trello →
                    </a>
                </div>
            ))}
        </div>
    );
}
