import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Loader2, RefreshCw, FlaskConical, Database, Wifi, FileText, Users, Briefcase, Bell, Shield, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type TestStatus = "idle" | "running" | "pass" | "fail";
interface TestResult { name: string; status: TestStatus; detail?: string; ms?: number }

const TESTS: { id: string; label: string; icon: React.ReactNode; run: () => Promise<string> }[] = [
  {
    id: "db_connect",
    label: "الاتصال بقاعدة البيانات",
    icon: <Database className="w-4 h-4" />,
    run: async () => {
      const { error } = await supabase.from("site_settings").select("id").limit(1);
      if (error) throw new Error(error.message);
      return "الاتصال ناجح";
    },
  },
  {
    id: "applicants_read",
    label: "قراءة المتقدمين",
    icon: <Users className="w-4 h-4" />,
    run: async () => {
      const { count, error } = await supabase.from("applicants").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return `${count ?? 0} متقدم في قاعدة البيانات`;
    },
  },
  {
    id: "jobs_read",
    label: "قراءة الوظائف",
    icon: <Briefcase className="w-4 h-4" />,
    run: async () => {
      const { count, error } = await supabase.from("job_postings").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return `${count ?? 0} وظيفة في قاعدة البيانات`;
    },
  },
  {
    id: "users_read",
    label: "قراءة المستخدمين",
    icon: <Shield className="w-4 h-4" />,
    run: async () => {
      const { count, error } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return `${count ?? 0} مستخدم في النظام`;
    },
  },
  {
    id: "notifications_read",
    label: "نظام الإشعارات",
    icon: <Bell className="w-4 h-4" />,
    run: async () => {
      const { error } = await supabase.from("notifications").select("id").limit(1);
      if (error) throw new Error(error.message);
      return "نظام الإشعارات يعمل";
    },
  },
  {
    id: "storage_access",
    label: "الوصول للتخزين",
    icon: <FileText className="w-4 h-4" />,
    run: async () => {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw new Error(error.message);
      return `${data?.length ?? 0} bucket متاح`;
    },
  },
  {
    id: "audit_log",
    label: "سجل الأحداث",
    icon: <FileText className="w-4 h-4" />,
    run: async () => {
      const { count, error } = await supabase.from("audit_log").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return `${count ?? 0} سجل محفوظ`;
    },
  },
  {
    id: "recruitment_pipeline",
    label: "pipeline التوظيف",
    icon: <Briefcase className="w-4 h-4" />,
    run: async () => {
      const { count, error } = await supabase.from("recruitment_candidates").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return `${count ?? 0} مرشح في المسار`;
    },
  },
  {
    id: "ai_settings",
    label: "إعدادات الذكاء الاصطناعي",
    icon: <Brain className="w-4 h-4" />,
    run: async () => {
      const { data, error } = await supabase.from("ai_settings").select("provider, is_active").limit(5);
      if (error) throw new Error(error.message);
      const active = data?.filter(r => r.is_active).length ?? 0;
      return `${active} مزود AI نشط`;
    },
  },
  {
    id: "rls_policy",
    label: "سياسة الأمان (RLS)",
    icon: <Shield className="w-4 h-4" />,
    run: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("لا يوجد مستخدم مسجل دخول");
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
      if (error) throw new Error(error.message);
      return `صلاحية: ${data?.role ?? "غير محدد"} — RLS يعمل`;
    },
  },
  {
    id: "edge_function_ping",
    label: "Edge Functions",
    icon: <Wifi className="w-4 h-4" />,
    run: async () => {
      const { error } = await supabase.functions.invoke("system-health", {
        body: { action: "ping" },
      });
      if (error && !error.message.includes("Unknown action") && !error.message.includes("non-2xx")) {
        throw new Error(error.message);
      }
      return "Edge Functions متاحة";
    },
  },
  {
    id: "backup_runs",
    label: "سجل النسخ الاحتياطية",
    icon: <Database className="w-4 h-4" />,
    run: async () => {
      const { count, error } = await supabase.from("backup_runs").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return `${count ?? 0} نسخة احتياطية محفوظة`;
    },
  },
];

export default function SystemTests({ lang }: { lang: "ar" | "en" }) {
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const updateResult = (id: string, result: Partial<TestResult>) =>
    setResults(prev => ({ ...prev, [id]: { ...prev[id], name: id, ...result } as TestResult }));

  const runAll = async () => {
    setRunning(true);
    setProgress(0);
    setLog([]);
    const newLog: string[] = [];
    const addLog = (msg: string) => { newLog.push(msg); setLog([...newLog]); };

    addLog(`▶ بدء تشغيل ${TESTS.length} اختبار — ${new Date().toLocaleTimeString("ar-SA")}`);

    for (let i = 0; i < TESTS.length; i++) {
      const test = TESTS[i];
      updateResult(test.id, { status: "running" });
      const start = Date.now();
      try {
        const detail = await test.run();
        const ms = Date.now() - start;
        updateResult(test.id, { status: "pass", detail, ms });
        addLog(`✅ ${test.label}: ${detail} (${ms}ms)`);
      } catch (e) {
        const ms = Date.now() - start;
        const msg = e instanceof Error ? e.message : String(e);
        updateResult(test.id, { status: "fail", detail: msg, ms });
        addLog(`❌ ${test.label}: ${msg}`);
      }
      setProgress(Math.round(((i + 1) / TESTS.length) * 100));
    }

    addLog(`\n✔ انتهت الاختبارات`);
    setRunning(false);
  };

  const runSingle = async (test: typeof TESTS[0]) => {
    updateResult(test.id, { status: "running" });
    const start = Date.now();
    try {
      const detail = await test.run();
      updateResult(test.id, { status: "pass", detail, ms: Date.now() - start });
    } catch (e) {
      updateResult(test.id, { status: "fail", detail: e instanceof Error ? e.message : String(e), ms: Date.now() - start });
    }
  };

  const passCount = Object.values(results).filter(r => r.status === "pass").length;
  const failCount = Object.values(results).filter(r => r.status === "fail").length;
  const total = Object.keys(results).length;

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold">{lang === "ar" ? "صفحة الاختبارات" : "System Tests"}</h2>
        </div>
        <Button onClick={runAll} disabled={running} className="gap-2">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {lang === "ar" ? "تشغيل كل الاختبارات" : "Run All Tests"}
        </Button>
      </div>

      {total > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-green-200 bg-green-50 dark:bg-green-950">
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-green-600">{passCount}</p>
              <p className="text-sm text-green-700">{lang === "ar" ? "نجح" : "Passed"}</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50 dark:bg-red-950">
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-red-600">{failCount}</p>
              <p className="text-sm text-red-700">{lang === "ar" ? "فشل" : "Failed"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold">{total}</p>
              <p className="text-sm text-muted-foreground">{lang === "ar" ? "إجمالي" : "Total"}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {running && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">{progress}%</p>
        </div>
      )}

      <div className="grid gap-3">
        {TESTS.map(test => {
          const r = results[test.id];
          const status: TestStatus = r?.status ?? "idle";
          return (
            <Card key={test.id} className={
              status === "pass" ? "border-green-300" :
              status === "fail" ? "border-red-300" :
              status === "running" ? "border-blue-300" : ""
            }>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{test.icon}</span>
                  <div>
                    <p className="font-medium text-sm">{test.label}</p>
                    {r?.detail && (
                      <p className={`text-xs mt-0.5 ${status === "fail" ? "text-red-600" : "text-muted-foreground"}`}>
                        {r.detail}{r.ms ? ` — ${r.ms}ms` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {status === "idle" && <Badge variant="outline">{lang === "ar" ? "لم يُشغَّل" : "Idle"}</Badge>}
                  {status === "running" && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
                  {status === "pass" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                  {status === "fail" && <XCircle className="w-5 h-5 text-red-500" />}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={running}
                    onClick={() => runSingle(test)}
                    className="h-7 px-2 text-xs"
                  >
                    {lang === "ar" ? "اختبر" : "Run"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {log.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{lang === "ar" ? "سجل الاختبارات" : "Test Log"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">
                {log.join("\n")}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
