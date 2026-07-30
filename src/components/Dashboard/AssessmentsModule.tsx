import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileQuestion, Plus, Trash2, Loader2, X, ClipboardCheck, Clock, Target } from "lucide-react";
import {
  useAssessmentsQuery,
  useAssessmentAssignmentsQuery,
  useCreateAssessmentMutation,
  useDeleteAssessmentMutation,
  useAssignAssessmentMutation,
  useUpdateAssignmentMutation,
  useGradeAssignmentMutation,
  type AssessmentAssignment,
  type AssignmentStatus,
  type QuestionType,
} from "@/hooks/queries/useAssessments";

const STATUS_STYLE: Record<AssignmentStatus, string> = {
  assigned: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  expired: "bg-destructive/15 text-destructive",
};

const STATUS_LABEL = (s: AssignmentStatus, ar: boolean) =>
  ar
    ? { assigned: "مُكلَّف", in_progress: "جارٍ", completed: "مكتمل", expired: "منتهي" }[s]
    : { assigned: "Assigned", in_progress: "In Progress", completed: "Completed", expired: "Expired" }[s];

const TYPE_LABEL = (t: QuestionType, ar: boolean) =>
  ar
    ? { multiple_choice: "اختيار من متعدد", true_false: "صح / خطأ", short_answer: "إجابة قصيرة" }[t]
    : { multiple_choice: "Multiple Choice", true_false: "True / False", short_answer: "Short Answer" }[t];

const QUESTION_TYPES: QuestionType[] = ["multiple_choice", "true_false", "short_answer"];

interface QuestionDraft {
  question_text: string;
  question_type: QuestionType;
  options: string;
  correct_answer: string;
  points: number;
}

const EMPTY_QUESTION: QuestionDraft = {
  question_text: "",
  question_type: "multiple_choice",
  options: "",
  correct_answer: "",
  points: 1,
};

export default function AssessmentsModule() {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const { data: assessments = [], isLoading: assessmentsLoading } = useAssessmentsQuery();
  const { data: assignments = [], isLoading: assignmentsLoading } = useAssessmentAssignmentsQuery();
  const createAssessment = useCreateAssessmentMutation();
  const deleteAssessment = useDeleteAssessmentMutation();
  const assignAssessment = useAssignAssessmentMutation();
  const updateAssignment = useUpdateAssignmentMutation();
  const gradeAssignment = useGradeAssignmentMutation();

  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [gradeTarget, setGradeTarget] = useState<AssessmentAssignment | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    duration_minutes: 30,
    passing_score: 60,
  });
  const [questions, setQuestions] = useState<QuestionDraft[]>([{ ...EMPTY_QUESTION }]);
  const [assignForm, setAssignForm] = useState({ assessment_id: "", applicant_name: "", due_date: "" });
  const [gradeForm, setGradeForm] = useState({ score: 0, max_score: 0 });

  const totalPoints = (id: string) =>
    (assessments.find((a) => a.id === id)?.questions ?? []).reduce((sum, q) => sum + (q.points ?? 0), 0);

  const stats = useMemo(() => {
    const graded = assignments.filter((a) => a.status === "completed" && a.score != null && (a.max_score ?? 0) > 0);
    const avg = graded.length
      ? Math.round(graded.reduce((sum, a) => sum + ((a.score ?? 0) / (a.max_score ?? 1)) * 100, 0) / graded.length)
      : 0;
    const completed = assignments.filter((a) => a.status === "completed");
    const passRate = completed.length
      ? Math.round((completed.filter((a) => a.passed).length / completed.length) * 100)
      : 0;
    return {
      total: assessments.length,
      pending: assignments.filter((a) => a.status === "assigned" || a.status === "in_progress").length,
      avg,
      passRate,
    };
  }, [assessments, assignments]);

  const resetAssessmentForm = () => {
    setForm({ title: "", description: "", category: "", duration_minutes: 30, passing_score: 60 });
    setQuestions([{ ...EMPTY_QUESTION }]);
  };

  const submitAssessment = () => {
    if (!form.title.trim()) return;
    const validQuestions = questions
      .filter((q) => q.question_text.trim())
      .map((q) => ({
        question_text: q.question_text.trim(),
        question_type: q.question_type,
        options: q.options.trim() || null,
        correct_answer: q.correct_answer.trim() || null,
        points: Number(q.points) || 1,
      }));
    createAssessment.mutate(
      {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        duration_minutes: Number(form.duration_minutes) || 30,
        passing_score: Number(form.passing_score) || 0,
        questions: validQuestions,
      },
      {
        onSuccess: () => {
          setAssessmentOpen(false);
          resetAssessmentForm();
        },
      }
    );
  };

  const submitAssign = () => {
    if (!assignForm.assessment_id || !assignForm.applicant_name.trim()) return;
    assignAssessment.mutate(
      {
        assessment_id: assignForm.assessment_id,
        applicant_name: assignForm.applicant_name.trim(),
        due_date: assignForm.due_date || null,
        max_score: totalPoints(assignForm.assessment_id) || null,
      },
      {
        onSuccess: () => {
          setAssignOpen(false);
          setAssignForm({ assessment_id: "", applicant_name: "", due_date: "" });
        },
      }
    );
  };

  const openGrade = (assignment: AssessmentAssignment) => {
    setGradeTarget(assignment);
    setGradeForm({
      score: assignment.score ?? 0,
      max_score: assignment.max_score ?? totalPoints(assignment.assessment_id) ?? 0,
    });
  };

  const submitGrade = () => {
    if (!gradeTarget) return;
    gradeAssignment.mutate(
      {
        id: gradeTarget.id,
        score: Number(gradeForm.score) || 0,
        max_score: Number(gradeForm.max_score) || 0,
        passing_score: gradeTarget.assessment?.passing_score ?? 0,
      },
      { onSuccess: () => setGradeTarget(null) }
    );
  };

  const gradePassing = gradeTarget?.assessment?.passing_score ?? 0;
  const gradeWillPass = Number(gradeForm.score) >= gradePassing;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-primary">{stats.total}</p>
            <p className="text-sm text-muted-foreground">{ar ? "إجمالي الاختبارات" : "Total Assessments"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-blue-600">{stats.pending}</p>
            <p className="text-sm text-muted-foreground">{ar ? "تكليفات قيد الانتظار" : "Pending Assignments"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-amber-600">{stats.avg}%</p>
            <p className="text-sm text-muted-foreground">{ar ? "متوسط الدرجات" : "Average Score"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-emerald-600">{stats.passRate}%</p>
            <p className="text-sm text-muted-foreground">{ar ? "نسبة النجاح" : "Pass Rate"}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bank">
        <TabsList>
          <TabsTrigger value="bank">{ar ? "الاختبارات" : "Assessments"}</TabsTrigger>
          <TabsTrigger value="assignments">{ar ? "التكليفات" : "Assignments"}</TabsTrigger>
        </TabsList>

        <TabsContent value="bank" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <FileQuestion className="w-5 h-5" />
                  {ar ? "بنك الاختبارات" : "Assessment Bank"}
                </CardTitle>
                <Button size="sm" className="gap-1" onClick={() => setAssessmentOpen(true)}>
                  <Plus className="w-4 h-4" />
                  {ar ? "اختبار جديد" : "New Assessment"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {assessmentsLoading ? (
                <div className="py-10 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              ) : assessments.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  {ar ? "لا توجد اختبارات بعد" : "No assessments yet"}
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {assessments.map((a) => (
                    <Card key={a.id} className="border-primary/20">
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{a.title}</p>
                            {a.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive shrink-0"
                            onClick={() => deleteAssessment.mutate(a.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {a.category && <Badge variant="secondary">{a.category}</Badge>}
                          <Badge variant="outline" className="gap-1">
                            <Clock className="w-3 h-3" />
                            {a.duration_minutes ?? 0} {ar ? "دقيقة" : "min"}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <Target className="w-3 h-3" />
                            {ar ? "النجاح: " : "Pass: "}
                            {a.passing_score ?? 0}
                          </Badge>
                          <Badge variant="outline">
                            {(a.questions ?? []).length} {ar ? "سؤال" : "questions"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {ar ? "مجموع الدرجات: " : "Total points: "}
                          {(a.questions ?? []).reduce((sum, q) => sum + (q.points ?? 0), 0)}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5" />
                  {ar ? "تكليفات المرشحين" : "Candidate Assignments"}
                </CardTitle>
                <Button
                  size="sm"
                  className="gap-1"
                  disabled={assessments.length === 0}
                  onClick={() => setAssignOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  {ar ? "تكليف جديد" : "New Assignment"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {assignmentsLoading ? (
                <div className="py-10 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              ) : assignments.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  {assessments.length === 0
                    ? ar
                      ? "أنشئ اختباراً أولاً من تبويب الاختبارات"
                      : "Create an assessment first"
                    : ar
                      ? "لا توجد تكليفات"
                      : "No assignments"}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{ar ? "المرشح" : "Candidate"}</TableHead>
                        <TableHead>{ar ? "الاختبار" : "Assessment"}</TableHead>
                        <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                        <TableHead>{ar ? "الدرجة" : "Score"}</TableHead>
                        <TableHead>{ar ? "تاريخ الاستحقاق" : "Due Date"}</TableHead>
                        <TableHead className="text-end">{ar ? "إجراءات" : "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignments.map((a) => {
                        const overdue =
                          a.due_date && a.status !== "completed" && new Date(a.due_date) < new Date();
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">{a.applicant_name || "—"}</TableCell>
                            <TableCell>{a.assessment?.title || "—"}</TableCell>
                            <TableCell>
                              <Select
                                value={a.status}
                                onValueChange={(v) =>
                                  updateAssignment.mutate({ id: a.id, status: v as AssignmentStatus })
                                }
                              >
                                <SelectTrigger className={`h-7 w-32 text-xs ${STATUS_STYLE[a.status]}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(["assigned", "in_progress", "completed", "expired"] as AssignmentStatus[]).map(
                                    (s) => (
                                      <SelectItem key={s} value={s}>
                                        {STATUS_LABEL(s, ar)}
                                      </SelectItem>
                                    )
                                  )}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {a.score == null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {a.score}/{a.max_score ?? 0}
                                  </span>
                                  <Badge
                                    className={
                                      a.passed
                                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                        : "bg-destructive/15 text-destructive"
                                    }
                                  >
                                    {a.passed ? (ar ? "ناجح" : "Passed") : ar ? "راسب" : "Failed"}
                                  </Badge>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className={overdue ? "text-destructive" : ""}>{a.due_date || "—"}</TableCell>
                            <TableCell className="text-end">
                              <Button size="sm" variant="outline" className="h-7" onClick={() => openGrade(a)}>
                                {ar ? "رصد الدرجة" : "Grade"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create assessment + question builder */}
      <Dialog open={assessmentOpen} onOpenChange={setAssessmentOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{ar ? "اختبار جديد" : "New Assessment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{ar ? "عنوان الاختبار *" : "Title *"}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>{ar ? "الوصف" : "Description"}</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>{ar ? "التصنيف" : "Category"}</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div>
                <Label>{ar ? "المدة (دقيقة)" : "Duration (min)"}</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>{ar ? "درجة النجاح" : "Passing Score"}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.passing_score}
                  onChange={(e) => setForm({ ...form, passing_score: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label>{ar ? "الأسئلة" : "Questions"}</Label>
              <div className="space-y-3 mt-1">
                {questions.map((q, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {ar ? `السؤال ${i + 1}` : `Question ${i + 1}`}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive"
                        disabled={questions.length === 1}
                        onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <Input
                      placeholder={ar ? "نص السؤال" : "Question text"}
                      value={q.question_text}
                      onChange={(e) =>
                        setQuestions(questions.map((x, j) => (j === i ? { ...x, question_text: e.target.value } : x)))
                      }
                    />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Select
                        value={q.question_type}
                        onValueChange={(v) =>
                          setQuestions(
                            questions.map((x, j) => (j === i ? { ...x, question_type: v as QuestionType } : x))
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {QUESTION_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {TYPE_LABEL(t, ar)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder={ar ? "الإجابة الصحيحة" : "Correct answer"}
                        value={q.correct_answer}
                        onChange={(e) =>
                          setQuestions(
                            questions.map((x, j) => (j === i ? { ...x, correct_answer: e.target.value } : x))
                          )
                        }
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder={ar ? "الدرجة" : "Points"}
                        value={q.points}
                        onChange={(e) =>
                          setQuestions(
                            questions.map((x, j) => (j === i ? { ...x, points: Number(e.target.value) } : x))
                          )
                        }
                      />
                    </div>
                    {q.question_type === "multiple_choice" && (
                      <Textarea
                        rows={2}
                        placeholder={ar ? "الخيارات (خيار في كل سطر)" : "Options (one per line)"}
                        value={q.options}
                        onChange={(e) =>
                          setQuestions(questions.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))
                        }
                      />
                    )}
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => setQuestions([...questions, { ...EMPTY_QUESTION }])}
                >
                  <Plus className="w-4 h-4" />
                  {ar ? "سؤال" : "Question"}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssessmentOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={submitAssessment} disabled={createAssessment.isPending || !form.title.trim()}>
              {createAssessment.isPending && <Loader2 className="w-4 h-4 animate-spin me-1" />}
              {ar ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign assessment */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ar ? "تكليف مرشح باختبار" : "Assign Assessment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{ar ? "الاختبار *" : "Assessment *"}</Label>
              <Select
                value={assignForm.assessment_id}
                onValueChange={(v) => setAssignForm({ ...assignForm, assessment_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={ar ? "اختر اختباراً" : "Select assessment"} />
                </SelectTrigger>
                <SelectContent>
                  {assessments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.title} ({(a.questions ?? []).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{ar ? "اسم المرشح *" : "Candidate Name *"}</Label>
              <Input
                value={assignForm.applicant_name}
                onChange={(e) => setAssignForm({ ...assignForm, applicant_name: e.target.value })}
              />
            </div>
            <div>
              <Label>{ar ? "تاريخ الاستحقاق" : "Due Date"}</Label>
              <Input
                type="date"
                value={assignForm.due_date}
                onChange={(e) => setAssignForm({ ...assignForm, due_date: e.target.value })}
              />
            </div>
            {assignForm.assessment_id && (
              <p className="text-xs text-muted-foreground">
                {ar ? "الدرجة الكلية: " : "Max score: "}
                {totalPoints(assignForm.assessment_id)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={submitAssign}
              disabled={assignAssessment.isPending || !assignForm.assessment_id || !assignForm.applicant_name.trim()}
            >
              {assignAssessment.isPending && <Loader2 className="w-4 h-4 animate-spin me-1" />}
              {ar ? "تكليف" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual grading */}
      <Dialog open={!!gradeTarget} onOpenChange={(open) => !open && setGradeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ar ? "رصد درجة الاختبار" : "Grade Assessment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {gradeTarget?.applicant_name} — {gradeTarget?.assessment?.title}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{ar ? "الدرجة المحققة *" : "Score *"}</Label>
                <Input
                  type="number"
                  min={0}
                  value={gradeForm.score}
                  onChange={(e) => setGradeForm({ ...gradeForm, score: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>{ar ? "الدرجة الكلية *" : "Max Score *"}</Label>
                <Input
                  type="number"
                  min={0}
                  value={gradeForm.max_score}
                  onChange={(e) => setGradeForm({ ...gradeForm, max_score: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {ar ? "درجة النجاح: " : "Passing score: "}
                {gradePassing}
              </span>
              <Badge
                className={
                  gradeWillPass
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-destructive/15 text-destructive"
                }
              >
                {gradeWillPass ? (ar ? "ناجح" : "Passed") : ar ? "راسب" : "Failed"}
              </Badge>
              {Number(gradeForm.max_score) > 0 && (
                <span className="text-muted-foreground">
                  ({Math.round((Number(gradeForm.score) / Number(gradeForm.max_score)) * 100)}%)
                </span>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradeTarget(null)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={submitGrade} disabled={gradeAssignment.isPending}>
              {gradeAssignment.isPending && <Loader2 className="w-4 h-4 animate-spin me-1" />}
              {ar ? "حفظ الدرجة" : "Save Grade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
