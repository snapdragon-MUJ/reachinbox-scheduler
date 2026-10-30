"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import Papa from "papaparse";
import { 
  Send, 
  Upload, 
  Search, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ExternalLink,
  Mail
} from "lucide-react";

interface ScheduledEmail {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  senderEmail: string;
  scheduledFor: string;
  sentAt: string | null;
  status: "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED" | "RATE_LIMITED";
  createdAt: string;
}

const BACKEND_URL = "http://localhost:5000";
const CURRENT_USER_ID = "user_demo_1";

export default function Dashboard() {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form states
  const [senderEmail, setSenderEmail] = useState("marketing@example.com");
  const [recipientsText, setRecipientsText] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [minDelaySec, setMinDelaySec] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch emails
  const fetchEmails = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/emails`, {
        params: { userId: CURRENT_USER_ID },
      });
      setEmails(res.data);
    } catch (err: any) {
      console.error("Failed to fetch emails:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
    const interval = setInterval(fetchEmails, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle CSV Upload
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const extracted: string[] = [];
        results.data.forEach((row: any) => {
          const emailVal = row.email || row.Email || row.EMAIL || Object.values(row)[0];
          if (emailVal && typeof emailVal === "string" && emailVal.includes("@")) {
            extracted.push(emailVal.trim());
          }
        });

        if (extracted.length > 0) {
          const current = recipientsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const merged = Array.from(new Set([...current, ...extracted]));
          setRecipientsText(merged.join(", "));
          setAlertMsg({ type: "success", text: `Imported ${extracted.length} recipient(s) from CSV!` });
        } else {
          setAlertMsg({ type: "error", text: "No valid email addresses found in CSV." });
        }
      },
    });
  };

  // Submit Schedule
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg(null);

    const recipientList = recipientsText
      .split(/[\n,]+/)
      .map((r) => r.trim())
      .filter((r) => r.includes("@"));

    if (recipientList.length === 0) {
      setAlertMsg({ type: "error", text: "Please enter at least one valid recipient email." });
      return;
    }

    setSubmitting(true);
    try {
      const targetTime = scheduledFor ? new Date(scheduledFor).toISOString() : new Date().toISOString();

      await axios.post(`${BACKEND_URL}/api/schedule`, {
        userId: CURRENT_USER_ID,
        senderEmail,
        recipients: recipientList,
        subject,
        body,
        scheduledFor: targetTime,
        minDelayMs: Number(minDelaySec) * 1000,
        hourlyLimit: Number(hourlyLimit),
      });

      setAlertMsg({ type: "success", text: `Successfully scheduled ${recipientList.length} email(s)!` });
      setRecipientsText("");
      setSubject("");
      setBody("");
      fetchEmails();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.response?.data?.error || "Failed to schedule emails." });
    } finally {
      setSubmitting(false);
    }
  };

  // Search handler
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchEmails();
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/emails/search`, {
        params: { q: searchQuery, userId: CURRENT_USER_ID },
      });
      setEmails(res.data);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Compute status summary counts
  const sentCount = emails.filter((e) => e.status === "SENT").length;
  const scheduledCount = emails.filter((e) => e.status === "SCHEDULED" || e.status === "PROCESSING").length;
  const rateLimitedCount = emails.filter((e) => e.status === "RATE_LIMITED").length;
  const failedCount = emails.filter((e) => e.status === "FAILED").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Mail className="h-7 w-7 text-indigo-400" /> Cold Email Scheduler
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Distributed BullMQ queue engine powered by Upstash Redis and Neon PostgreSQL
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="http://localhost:5000/admin/queues"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              <span>Queue Dashboard</span>
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={fetchEmails}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-sm">
              <span>Scheduled</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold mt-2 text-white">{scheduledCount}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-sm">
              <span>Dispatched</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold mt-2 text-white">{sentCount}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-sm">
              <span>Rate Limited</span>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold mt-2 text-white">{rateLimitedCount}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-sm">
              <span>Failed</span>
              <XCircle className="h-4 w-4 text-rose-400" />
            </div>
            <p className="text-2xl font-bold mt-2 text-white">{failedCount}</p>
          </div>
        </div>

        {/* Schedule Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-white mb-4">Compose & Schedule Dispatch</h2>
          
          {alertMsg && (
            <div className={`p-4 mb-4 rounded-lg text-sm ${alertMsg.type === "success" ? "bg-emerald-950/60 border border-emerald-800 text-emerald-300" : "bg-rose-950/60 border border-rose-800 text-rose-300"}`}>
              {alertMsg.text}
            </div>
          )}

          <form onSubmit={handleScheduleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Sender Email</label>
                <input
                  type="email"
                  required
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Scheduled Start Date & Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300">
                  Recipients (comma or line separated)
                </label>
                <label className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1 font-medium">
                  <Upload className="h-3.5 w-3.5" /> Upload CSV
                  <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                </label>
              </div>
              <textarea
                required
                rows={3}
                placeholder="alice@example.com, bob@company.org"
                value={recipientsText}
                onChange={(e) => setRecipientsText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="ReachInbox partnership proposal"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Delay Between (sec)</label>
                  <input
                    type="number"
                    min="0"
                    value={minDelaySec}
                    onChange={(e) => setMinDelaySec(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Hourly Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Body</label>
              <textarea
                required
                rows={4}
                placeholder="Hello {{name}}, wanted to reach out regarding..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span>{submitting ? "Queueing Jobs..." : "Schedule Email Campaign"}</span>
            </button>
          </form>
        </div>

        {/* Email Logs & Search */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-white">Execution Logs</h2>

            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search recipient, subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 w-64"
                />
              </div>
              <button
                type="submit"
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-sm transition"
              >
                Search
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Scheduled Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Dispatched At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {emails.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No emails queued or dispatched yet.
                    </td>
                  </tr>
                ) : (
                  emails.map((email) => (
                    <tr key={email.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono text-xs text-white">{email.recipient}</td>
                      <td className="py-3 px-4 text-slate-300">{email.subject}</td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {new Date(email.scheduledFor).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            email.status === "SENT"
                              ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                              : email.status === "SCHEDULED" || email.status === "PROCESSING"
                              ? "bg-amber-950/80 text-amber-400 border border-amber-800"
                              : email.status === "RATE_LIMITED"
                              ? "bg-purple-950/80 text-purple-400 border border-purple-800"
                              : "bg-rose-950/80 text-rose-400 border border-rose-800"
                          }`}
                        >
                          {email.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {email.sentAt ? new Date(email.sentAt).toLocaleTimeString() : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
