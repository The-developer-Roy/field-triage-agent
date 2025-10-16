"use client";

import { useEffect, useState, useMemo } from "react";

interface Report {
    id: string;
    name: string;
    desc: string;
    url: string;
    attachments: string[];
    idList?: string;
    listName?: string;
}

export default function ReportsDashboard() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOrder, setSortOrder] = useState("desc");
    const [selectedList, setSelectedList] = useState("All");

    useEffect(() => {
        (async () => {
            const res = await fetch("/api/reports");
            const data = await res.json();
            if (data.success) setReports(data.data);
            setLoading(false);
        })();
    }, []);

    // Extract list names for dropdown
    const listNames = useMemo(() => {
        const names = Array.from(new Set(reports.map((r) => r.listName || "Unknown")));
        return ["All", ...names];
    }, [reports]);

    // Filtering + Sorting
    const filteredReports = useMemo(() => {
        let filtered = reports.slice();

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (r) =>
                    (r.name || "").toLowerCase().includes(q) ||
                    (r.desc || "").toLowerCase().includes(q)
            );
        }

        if (selectedList !== "All") {
            filtered = filtered.filter((r) => (r.listName || "Unknown") === selectedList);
        }

        if (sortOrder === "asc") filtered = filtered.reverse();

        return filtered;
    }, [reports, searchTerm, sortOrder, selectedList]);

    // Badge color utility
    const getBadgeColor = (listName?: string) => {
        const name = (listName || "").toLowerCase();
        switch (name) {
            case "to do":
                return "bg-blue-100 text-blue-700";
            case "in progress":
                return "bg-yellow-100 text-yellow-700";
            case "done":
                return "bg-green-100 text-green-700";
            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    if (loading) return <p className="text-center mt-10">Loading reports...</p>;

    return (
        <div className="p-6">
            {/* Filters */}
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Search reports..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border border-gray-300 rounded-lg p-2 w-full md:w-1/3 focus:ring-2 focus:ring-blue-400 outline-none"
                />

                <div className="flex gap-3 w-full md:w-auto">
                    <select
                        value={selectedList}
                        onChange={(e) => setSelectedList(e.target.value)}
                        className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-400 outline-none"
                    >
                        {listNames.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>

                    <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                        className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-400 outline-none"
                    >
                        <option value="desc">Newest First</option>
                        <option value="asc">Oldest First</option>
                    </select>
                </div>
            </div>

            {/* Report Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredReports.length === 0 ? (
                    <p className="text-gray-500">No reports found.</p>
                ) : (
                    filteredReports.map((report) => (
                        <div
                            key={report.id}
                            className="bg-white rounded-2xl shadow-md p-4 hover:shadow-xl transition"
                        >
                            <div className="flex justify-between items-center mb-2">
                                <h2 className="text-lg font-semibold">{report.name}</h2>
                                <span
                                    className={`text-xs font-medium px-2 py-1 rounded-full ${getBadgeColor(
                                        report.listName
                                    )}`}
                                >
                                    {report.listName ?? "Unknown"}
                                </span>
                            </div>

                            <p className="text-sm text-gray-600 mb-3">{report.desc}</p>

                            {report.attachments && report.attachments.length > 0 && (
                                <div className="grid grid-cols-1 gap-2 mb-3">
                                    {report.attachments.map((attUrl, idx) => (
                                        <img
                                            key={attUrl ?? `${report.id}-${idx}`}
                                            src={attUrl}
                                            alt={`attachment-${idx}`}
                                            className="w-full h-40 object-cover rounded-lg"
                                        />
                                    ))}
                                </div>
                            )}

                            <a
                                href={report.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-blue-600 text-sm mt-3 hover:underline"
                            >
                                View on Trello →
                            </a>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
