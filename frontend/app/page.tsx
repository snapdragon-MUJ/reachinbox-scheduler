"use client";

import React, { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import axios from "axios";
import Papa from "papaparse";
import { Send, Upload, RefreshCw, CheckCircle2, AlertCircle, LogOut } from "lucide-react";

interface ScheduledEmail {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  scheduledFor?: string;
  scheduledAt?: string;
  sentAt?: string;
  createdAt?: string;
  error?: string;
}

export default function Dashboard() {
  const { data: session, status: authStatus } = useSession();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientsText, setRecipientsText] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [scheduledTime, setScheduledTime] = useState("");
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchEmails = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/emails");
      const data = Array.isArray(res.data) ? res.data : (res.data?.emails || []);
      setEmails(data);
    } catch (err: any) {
      console.warn("Backend poll warning:", err?.message);
    }
  };

  useEffect(() => {
    if (session) {
      fetchEmails();
      const interval = setInterval(fetchEmails, 2000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const extracted: string[] = [];
        results.data.forEach((row: any) => {
          row.forEach((cell: any) => {
            const email = String(cell).trim();
            if (email.includes("@") && email.includes(".")) {
              extracted.push(email);
            }
          });
        });
        if (extracted.length > 0) {
          setRecipientsText(extracted.join(", "));
          setMessage({ text: `Imported ${extracted.length} recipient(s) from CSV.`, type: "success" });
        }
      },
    });
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const recipients = recipientsText
      .split(/[\n,]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (recipients.length === 0) {
      setMessage({ text: "Please provide at least one recipient.", type: "error" });
      setLoading(false);
      return;
    }

    try {
      await axios.post("http://localhost:5000/api/schedule", {
        recipients,
        subject,
        body,
        delaySeconds: Number(delaySeconds),
        hourlyLimit: Number(hourlyLimit),
        scheduledTime: scheduledTime ? new Date(scheduledTime).toISOString() : new Date().toISOString(),
        userId: session?.user?.email || "default_user",
        senderEmail: session?.user?.email || "noreply@reachinbox.ai",
      });

      setMessage({ text: `Successfully scheduled batch of ${recipients.length} email(s)!`, type: "success" });
      fetchEmails();
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || "Failed to schedule batch.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-sans">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 font-sans text-slate-100">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-blue-600/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto">
            <Send className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">ReachInbox Scheduler</h1>
            <p className="text-sm text-slate-400 mt-2">Sign in to manage and dispatch automated cold email campaigns.</p>
          </div>
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-medium py-3 px-4 rounded-xl transition shadow"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
            R
          </div>
          <span className="font-semibold text-lg tracking-tight">ReachInbox Dispatch</span>
        </div>

        {/* User Profile & Sign Out */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-slate-800/60 py-1.5 px-3 rounded-full border border-slate-700/60">
            {session.user?.image ? (
              <img src={session.user.image} alt={session.user.name || "User"} className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
                {session.user?.name?.[0] || "U"}
              </div>
            )}
            <div className="text-left text-xs leading-tight pr-1">
              <p className="font-semibold text-slate-200">{session.user?.name}</p>
              <p className="text-slate-400">{session.user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Dashboard Body */}
      <main className="max-w-6xl mx-auto mt-8 px-4 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-5 bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Compose Campaign</h2>

          {message && (
            <div
              className={`p-3 rounded-lg text-sm mb-4 flex items-center gap-2 ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              }`}
            >
              {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {message.text}
            </div>
          )}

          <form onSubmit={handleSchedule} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-400">Subject</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Product Demo & Introduction"
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-slate-400">Recipients</label>
                <label className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  Import CSV
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
              <textarea
                required
                rows={3}
                value={recipientsText}
                onChange={(e) => setRecipientsText(e.target.value)}
                placeholder="alex@reachinbox.ai, team@reachinbox.ai"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400">Email Body</label>
              <textarea
                required
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Hi {{name}}, wanted to connect regarding..."
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-400">Delay (seconds)</label>
                <input
                  type="number"
                  min="0"
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400">Hourly Limit</label>
                <input
                  type="number"
                  min="1"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400">Scheduled Time (Optional)</label>
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Schedule Email Campaign
            </button>
          </form>
        </section>

        <section className="lg:col-span-7 bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Execution Logs</h2>
              <p className="text-xs text-slate-400">Real-time status updates from Neon PostgreSQL</p>
            </div>
            <button
              onClick={fetchEmails}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-lg transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Recipient</th>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {emails.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">
                      No emails queued or dispatched yet.
                    </td>
                  </tr>
                ) : (
                  emails.map((item) => {
                    const rawTime = item.sentAt || item.scheduledFor || item.scheduledAt || item.createdAt;
                    const displayTime = rawTime ? new Date(rawTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--";

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-medium text-slate-200">{item.recipient}</td>
                        <td className="py-3 px-3 text-slate-300">{item.subject}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                              item.status === "SENT"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : item.status === "PROCESSING"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : item.status === "FAILED"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-400 font-mono">
                          {displayTime}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
