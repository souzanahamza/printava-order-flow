
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    BookOpen,
    Workflow,
    Users,
    FileText,
    Calculator,
    Package,
    Truck,
    Settings,
    ShoppingCart,
    UserCircle,
    Factory,
    DollarSign,
    Palette,
    ClipboardCheck,
    ArrowLeft,
    ArrowRight,
    Lightbulb,
    AlertCircle,
    CheckCircle2,
    Clock,
    Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// ============== Workflow Phases Data ==============
const phases = [
    {
        title: "مرحلة التصميم",
        icon: Palette,
        description: "المرحلة التي يتم فيها تصميم الملفات حسب طلب العميل",
        statuses: [
            {
                name: "Ready for Design",
                role: "Designer",
                desc: "الطلب جديد في طابور الانتظار. لم يبدأ العمل عليه بعد.",
                descEn: "Order is queued and waiting for a designer to start working on it.",
                action: "Start Designing",
                tips: "المصمم يرى هذه الطلبات في الـ Dashboard الخاص به ويختار أي طلب للبدء فيه."
            },
            {
                name: "In Design",
                role: "Designer",
                desc: "المصمم يعمل حالياً على التصميم (يُحتسب وقت العمل الفعلي).",
                descEn: "Designer is actively working on the design. Work time is being tracked.",
                action: "Upload Proof",
                tips: "عند الانتهاء، يرفع المصمم البروفة (صورة أو ملف) للموافقة."
            },
            {
                name: "Design Approval",
                role: "Sales",
                desc: "تم رفع البروفة. بانتظار موافقة العميل عبر قسم المبيعات.",
                descEn: "Proof uploaded. Waiting for client approval through sales team.",
                action: "Approve / Request Revision",
                tips: "المبيعات يتواصل مع العميل ويختار: موافقة أو طلب تعديل."
            },
            {
                name: "Design Revision",
                role: "Designer",
                desc: "العميل طلب تعديلات على التصميم.",
                descEn: "Client requested changes to the design.",
                action: "Re-upload Proof",
                tips: "يمكن رؤية ملاحظات العميل في التعليقات. بعد التعديل يُرفع بروفة جديدة."
            },
            {
                name: "Waiting for Print File",
                role: "Designer",
                desc: "تمت الموافقة على البروفة. بانتظار رفع ملف الطباعة النهائي.",
                descEn: "Proof approved. Waiting for final print-ready file upload.",
                action: "Upload Print File",
                tips: "ملف الطباعة يختلف عن البروفة - يجب أن يكون بجودة عالية وجاهز للطباعة."
            }
        ]
    },
    {
        title: "المرحلة المالية",
        icon: Calculator,
        description: "مرحلة الدفع والتحقق من الحسابات",
        statuses: [
            {
                name: "Pending Payment",
                role: "Accountant",
                desc: "ملف الطباعة جاهز. بانتظار تسوية الدفع من العميل.",
                descEn: "Print file ready. Waiting for payment settlement from client.",
                action: "Confirm Payment",
                tips: "المحاسب يسجل الدفعة (كاملة أو جزئية) وينقل الطلب للإنتاج."
            }
        ]
    },
    {
        title: "مرحلة الإنتاج",
        icon: Factory,
        description: "مرحلة الطباعة والإنتاج الفعلي",
        statuses: [
            {
                name: "Ready for Production",
                role: "Production",
                desc: "الطلب مدفوع وجاهز في طابور الطباعة.",
                descEn: "Order is paid and queued for printing.",
                action: "Start Job",
                tips: "فريق الإنتاج يرى قائمة الطلبات الجاهزة ويبدأ بالطباعة حسب الأولوية."
            },
            {
                name: "In Production",
                role: "Production",
                desc: "الماكينات تعمل حالياً على طباعة هذا الطلب.",
                descEn: "Machines are currently printing this order.",
                action: "Mark as Ready",
                tips: "بعد انتهاء الطباعة والتجهيز، يُنقل الطلب لمرحلة التسليم."
            }
        ]
    },
    {
        title: "مرحلة التسليم",
        icon: Truck,
        description: "مرحلة تسليم الطلب للعميل",
        statuses: [
            {
                name: "Ready for Pickup",
                role: "Sales / Accountant",
                desc: "الطلب جاهز في المحل. بانتظار استلام العميل.",
                descEn: "Order is ready at the shop. Waiting for client pickup.",
                action: "Handover & Collect Final Payment",
                tips: "عند التسليم، يتم تحصيل أي مبالغ متبقية وتأكيد الاستلام."
            },
            {
                name: "Delivered",
                role: "System",
                desc: "تم تسليم الطلب للعميل بنجاح.",
                descEn: "Order has been successfully delivered to the client.",
                action: "View / Reorder",
                tips: "يمكن إعادة طلب نفس المنتجات بضغطة واحدة (Reorder)."
            },
            {
                name: "Canceled",
                role: "Admin",
                desc: "تم إلغاء الطلب.",
                descEn: "Order has been canceled.",
                action: "-",
                tips: "الطلبات الملغية تبقى محفوظة للسجلات."
            }
        ]
    }
];

// ============== User Roles Data ==============
const userRoles = [
    {
        role: "Admin (مدير النظام)",
        icon: Settings,
        color: "bg-purple-500",
        permissions: [
            "الوصول الكامل لجميع أقسام النظام",
            "إدارة الفريق والصلاحيات",
            "إدارة إعدادات الشركة والتسعير",
            "إدارة حالات الطلبات وتخصيصها",
            "عرض التقارير والإحصائيات الكاملة",
            "عرض تاريخ الطلب (Timeline) الكامل",
        ],
        pages: ["Dashboard", "Orders", "New Order", "Quotations", "Clients", "Products", "Production", "Settings", "Team", "Statuses", "Pricing"]
    },
    {
        role: "Sales (المبيعات)",
        icon: ShoppingCart,
        color: "bg-blue-500",
        permissions: [
            "إنشاء طلبات جديدة وعروض أسعار",
            "إدارة العملاء وبياناتهم",
            "مراجعة البروفات والموافقة أو طلب تعديل",
            "تسليم الطلبات للعملاء",
            "طباعة الفواتير وعروض الأسعار",
        ],
        pages: ["Dashboard", "Orders", "New Order", "Quotations", "Clients", "Products"]
    },
    {
        role: "Designer (المصمم)",
        icon: Palette,
        color: "bg-pink-500",
        permissions: [
            "عرض الطلبات المطلوب تصميمها",
            "البدء بالتصميم ورفع البروفات",
            "رفع ملفات الطباعة النهائية",
            "عرض ملاحظات وتعليقات المراجعة",
        ],
        pages: ["Dashboard (Designer View)", "Orders"]
    },
    {
        role: "Accountant (المحاسب)",
        icon: Calculator,
        color: "bg-green-500",
        permissions: [
            "تأكيد الدفعات وتسجيلها",
            "عرض العملاء ومعلوماتهم المالية",
            "تسليم الطلبات وتحصيل المبالغ المتبقية",
            "طباعة الفواتير",
        ],
        pages: ["Dashboard (Accountant View)", "Orders", "Clients", "Products"]
    },
    {
        role: "Production (الإنتاج)",
        icon: Factory,
        color: "bg-orange-500",
        permissions: [
            "عرض الطلبات الجاهزة للطباعة",
            "البدء بالإنتاج وتحديث الحالة",
            "تحديد الطلب كجاهز للتسليم",
        ],
        pages: ["Orders", "Products", "Production"]
    }
];

// ============== Features Guide Data ==============
const featuresGuide = [
    {
        title: "إنشاء طلب جديد",
        icon: ShoppingCart,
        steps: [
            "اذهب إلى صفحة 'New Order' من القائمة الجانبية",
            "اختر العميل من القائمة أو أضف عميل جديد بالضغط على زر +",
            "حدد تاريخ ووقت التسليم المطلوب",
            "اختر العملة وطريقة التسليم (Pickup أو Courier)",
            "اختر فئة التسعير (Pricing Tier) إن وجدت",
            "فعّل خيار 'Requires Design' إذا كان الطلب يحتاج تصميم",
            "ارفع الملفات المطلوبة (ملفات مرجعية أو ملفات طباعة جاهزة)",
            "أضف المنتجات المطلوبة مع الكميات",
            "اضغط 'Create Order' لإنشاء الطلب"
        ],
        tips: [
            "إذا كان الطلب يحتاج تصميم، سيبدأ من 'Ready for Design'",
            "إذا كان الملف جاهز للطباعة، سيذهب مباشرة إلى 'Pending Payment'",
            "يمكنك تحويل أي عرض سعر (Quotation) إلى طلب مباشرة"
        ]
    },
    {
        title: "إنشاء عرض سعر",
        icon: FileText,
        steps: [
            "اذهب إلى صفحة 'Quotations' ثم اضغط 'New Quotation'",
            "أدخل بيانات العميل والمنتجات المطلوبة",
            "حدد تاريخ صلاحية العرض",
            "يمكنك طباعة العرض أو تحويله إلى طلب لاحقاً"
        ],
        tips: [
            "عروض الأسعار مفيدة للعملاء الذين يريدون معرفة التكلفة قبل الموافقة",
            "يمكن تحويل العرض إلى طلب بضغطة واحدة مع الحفاظ على كل البيانات"
        ]
    },
    {
        title: "إدارة العملاء",
        icon: UserCircle,
        steps: [
            "اذهب إلى صفحة 'Clients' لعرض قائمة العملاء",
            "استخدم البحث للوصول السريع لأي عميل",
            "اضغط على 'Add Client' لإضافة عميل جديد",
            "اضغط على أيقونة التعديل لتحديث بيانات العميل",
            "اضغط على أيقونة السجل لعرض جميع طلبات العميل"
        ],
        tips: [
            "يمكن تحديد فئة تسعير افتراضية لكل عميل",
            "يمكن تحديد عملة افتراضية لكل عميل",
            "الرقم الضريبي (TRN) يظهر في الفواتير"
        ]
    },
    {
        title: "مراجعة التصميم والموافقة",
        icon: ClipboardCheck,
        steps: [
            "عندما يرفع المصمم بروفة، تتحول الحالة إلى 'Design Approval'",
            "افتح تفاصيل الطلب وراجع البروفة في قسم 'Design Proofs'",
            "تواصل مع العميل للحصول على الموافقة",
            "اختر 'Approve' للموافقة أو 'Request Revision' لطلب تعديل",
            "في حالة طلب التعديل، أضف ملاحظات توضيحية للمصمم"
        ],
        tips: [
            "جميع المراجعات السابقة محفوظة في قسم 'Archived History'",
            "التعليقات تظهر للمصمم ليفهم المطلوب بالضبط"
        ]
    },
    {
        title: "تسجيل الدفعات",
        icon: DollarSign,
        steps: [
            "عندما يصل الطلب لحالة 'Pending Payment'",
            "افتح تفاصيل الطلب كمحاسب",
            "سترى بطاقة الدفع مع المبلغ المطلوب",
            "أدخل المبلغ المدفوع واختر طريقة الدفع",
            "اضغط 'Confirm Payment' لتأكيد الدفعة",
            "إذا كان الدفع كاملاً، ينتقل الطلب للإنتاج"
        ],
        tips: [
            "يمكن تسجيل دفعات جزئية",
            "المبلغ المتبقي يظهر عند التسليم لتحصيله من العميل",
            "طريقة الدفع تُسجل للتقارير المالية"
        ]
    },
    {
        title: "الإنتاج والطباعة",
        icon: Factory,
        steps: [
            "اذهب إلى صفحة 'Production' لرؤية طابور الطباعة",
            "الطلبات بحالة 'Ready for Production' جاهزة للبدء",
            "اضغط 'Start' لبدء الطباعة (تتحول إلى 'In Production')",
            "بعد الانتهاء، اضغط 'Mark Ready' للتسليم"
        ],
        tips: [
            "رتّب الطلبات حسب تاريخ التسليم المطلوب",
            "يمكن تحميل ملف الطباعة مباشرة من صفحة الإنتاج"
        ]
    },
    {
        title: "التسليم للعميل",
        icon: Truck,
        steps: [
            "عندما يصل الطلب لحالة 'Ready for Pickup'",
            "افتح تفاصيل الطلب",
            "إذا كان هناك مبلغ متبقي، سيظهر لتحصيله",
            "سجّل الدفعة النهائية إن وجدت",
            "اضغط 'Complete Delivery' لإتمام التسليم"
        ],
        tips: [
            "يمكن طباعة الفاتورة قبل التسليم",
            "بعد التسليم يمكن عمل 'Reorder' لنفس المنتجات"
        ]
    },
    {
        title: "طباعة الفاتورة",
        icon: FileText,
        steps: [
            "افتح تفاصيل أي طلب",
            "اضغط على زر 'Print Invoice' في الأعلى",
            "انتظر تحميل القالب ثم ستفتح نافذة الطباعة",
            "اختر الطابعة أو احفظ كـ PDF"
        ],
        tips: [
            "الفاتورة تحتوي على شعار الشركة وبياناتها",
            "بيانات العميل والرقم الضريبي تظهر تلقائياً",
            "يمكن طباعة عروض الأسعار بنفس الطريقة"
        ]
    }
];

// ============== Quick Tips Data ==============
const quickTips = [
    {
        icon: Star,
        title: "إعادة الطلب بسرعة",
        desc: "من تفاصيل أي طلب مكتمل، اضغط 'Reorder' لإنشاء طلب جديد بنفس البيانات والملفات."
    },
    {
        icon: Clock,
        title: "تتبع الوقت",
        desc: "النظام يحسب تلقائياً الوقت الذي يقضيه كل طلب في كل مرحلة (للمدير فقط)."
    },
    {
        icon: AlertCircle,
        title: "العملات المتعددة",
        desc: "يمكنك إنشاء طلبات بعملات مختلفة. سعر الصرف يُحفظ تلقائياً ويمكن تعديله يدوياً."
    },
    {
        icon: CheckCircle2,
        title: "فئات التسعير",
        desc: "استخدم فئات التسعير (Pricing Tiers) لتحديد نسب ربح مختلفة لكل نوع عميل."
    },
    {
        icon: Lightbulb,
        title: "البحث السريع",
        desc: "استخدم خانة البحث في صفحة الطلبات للبحث برقم الطلب أو اسم العميل."
    },
    {
        icon: Star,
        title: "فلترة الطلبات",
        desc: "استخدم الفلاتر لعرض طلبات بحالة معينة أو فترة زمنية محددة."
    }
];

export function WorkflowGuideDialog() {
    const { data: statuses } = useOrderStatuses();
    const [activeTab, setActiveTab] = useState("workflow");

    const getStatusColor = (name: string) => {
        return statuses?.find(s => s.name === name)?.color;
    };

    return (
        <Dialog>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <BookOpen className="h-5 w-5" />
                                <span className="sr-only">دليل النظام</span>
                            </Button>
                        </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>دليل النظام الشامل</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <DialogContent className="max-w-5xl max-h-[90vh] p-0 font-arabic" dir="ltr">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <div className="flex flex-row-reverse items-center justify-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <BookOpen className="h-6 w-6 text-primary" />
                        </div>
                        <div className="text-center">
                            <DialogTitle className="text-2xl font-bold">
                                دليل النظام الشامل
                            </DialogTitle>
                            <DialogDescription className="text-base mt-1">
                                كل ما تحتاج معرفته لاستخدام النظام بكفاءة - مراحل العمل، الصلاحيات، والإرشادات
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1" dir="rtl">
                    <div className="px-6 py-3 border-b bg-muted/30">
                        <TabsList className="flex w-full max-w-2xl mx-auto flex-row-reverse">
                            <TabsTrigger value="workflow" className="flex-1 flex flex-row-reverse items-center justify-center gap-2">
                                <Workflow className="h-4 w-4" />
                                <span className="hidden sm:inline">مراحل العمل</span>
                            </TabsTrigger>
                            <TabsTrigger value="roles" className="flex-1 flex flex-row-reverse items-center justify-center gap-2">
                                <Users className="h-4 w-4" />
                                <span className="hidden sm:inline">الصلاحيات</span>
                            </TabsTrigger>
                            <TabsTrigger value="features" className="flex-1 flex flex-row-reverse items-center justify-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span className="hidden sm:inline">كيف أقوم بـ</span>
                            </TabsTrigger>
                            <TabsTrigger value="tips" className="flex-1 flex flex-row-reverse items-center justify-center gap-2">
                                <Lightbulb className="h-4 w-4" />
                                <span className="hidden sm:inline">نصائح</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="h-[calc(90vh-200px)]">
                        {/* ============== WORKFLOW TAB ============== */}
                        <TabsContent value="workflow" className="p-6 space-y-6 mt-0">
                            <div className="rounded-lg border bg-gradient-to-r from-primary/5 to-primary/10 p-4 text-right">
                                <h3 className="font-semibold text-lg mb-2 flex flex-row-reverse items-center gap-2">
                                    <Workflow className="h-5 w-5 text-primary" />
                                    مسار الطلب في النظام
                                </h3>
                                <p className="text-muted-foreground text-sm">
                                    كل طلب يمر بمراحل متسلسلة من التصميم إلى التسليم. كل مرحلة لها مسؤول معين وإجراء محدد
                                </p>
                                <div className="flex items-center gap-2 mt-3 flex-wrap text-xs">
                                    <Badge variant="outline" className="bg-pink-500/10 text-pink-700 border-pink-300">تصميم</Badge>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                    <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-300">مالية</Badge>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                    <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-300">إنتاج</Badge>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                    <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-300">تسليم</Badge>
                                </div>
                            </div>

                            {phases.map((phase, index) => (
                                <div key={index} className="space-y-4">
                                    <div className="flex flex-row-reverse items-center gap-3 text-right">
                                        <div className="p-2 rounded-lg bg-primary/10">
                                            <phase.icon className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold">{phase.title}</h3>
                                            <p className="text-sm text-muted-foreground">{phase.description}</p>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="w-[180px] text-right">الحالة</TableHead>
                                                    <TableHead className="w-[100px] text-right">المسؤول</TableHead>
                                                    <TableHead className="text-right">الوصف</TableHead>
                                                    <TableHead className="w-[160px] text-right">الإجراء</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {phase.statuses.map((item, idx) => (
                                                    <TableRow key={idx} className="group">
                                                        <TableCell className="text-right">
                                                            <StatusBadge
                                                                status={item.name}
                                                                color={getStatusColor(item.name)}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Badge variant="secondary" className="font-medium">
                                                                {item.role}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="space-y-1">
                                                                <p className="text-sm" dir="rtl">{item.desc}</p>
                                                                <p className="text-xs text-muted-foreground text-left font-sans" dir="ltr">{item.descEn}</p>
                                                                <p className="text-xs text-primary/80 mt-2 hidden group-hover:block" dir="rtl">
                                                                    <Lightbulb className="h-3 w-3 inline ml-1" />
                                                                    {item.tips}
                                                                </p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Badge variant="outline" className="font-mono text-xs bg-muted/50">
                                                                {item.action}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ))}

<div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-4 text-right" dir="rtl">
    
    {/* العنوان: حذفنا flex-row-reverse واعتمدنا الترتيب الطبيعي مع gap */}
    <h4 className="font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-200">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <span>ملاحظة مهمة</span>
    </h4>
    
    {/* النص: dir="auto" هو الحل السحري لضبط الأقواس والكلمات الإنجليزية وسط العربي */}
    <p className="text-sm text-amber-700 dark:text-amber-300 mt-2 leading-relaxed" dir="auto">
        إذا كان الطلب لا يحتاج تصميم (الملف جاهز للطباعة)، يمكن تخطي مرحلة التصميم بالكامل 
        والانتقال مباشرة إلى المرحلة المالية <span dir="ltr" className="inline-block font-sans">(Pending Payment)</span>.
    </p>
</div>
                        </TabsContent>

                        {/* ============== ROLES TAB ============== */}
                        <TabsContent value="roles" className="p-6 space-y-6 mt-0">
                            <div className="rounded-lg border bg-gradient-to-r from-primary/5 to-primary/10 p-4 text-right">
                                <h3 className="font-semibold text-lg mb-2 flex flex-row-reverse items-center gap-2">
                                    <Users className="h-5 w-5 text-primary" />
                                    أدوار المستخدمين والصلاحيات
                                </h3>
                                <p className="text-muted-foreground text-sm">
                                    لكل مستخدم في النظام دور محدد بصلاحيات معينة. المدير يحدد أدوار المستخدمين من صفحة Team.
                                </p>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                {userRoles.map((item, index) => (
                                    <Card key={index} className="overflow-hidden text-right">
                                        <CardHeader className="pb-3">
                                            <div className="flex flex-row-reverse items-center gap-3">
                                                <div className={`p-2 rounded-lg ${item.color}/10`}>
                                                    <item.icon className={`h-5 w-5 ${item.color.replace('bg-', 'text-')}`} />
                                                </div>
                                                <CardTitle className="text-lg">{item.role}</CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div>
                                                <h4 className="text-sm font-semibold mb-2 text-muted-foreground">:الصلاحيات</h4>
                                                <ul className="space-y-1">
                                                    {item.permissions.map((perm, pIdx) => (
                                                        <li key={pIdx} className="text-sm flex flex-row-reverse items-start gap-2">
                                                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                                            {perm}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <Separator />
                                            <div>
                                                <h4 className="text-sm font-semibold mb-2 text-muted-foreground">الصفحات المتاحة:</h4>
                                                <div className="flex flex-wrap gap-1">
                                                    {item.pages.map((page, pIdx) => (
                                                        <Badge key={pIdx} variant="secondary" className="text-xs">
                                                            {page}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>

                        {/* ============== FEATURES TAB ============== */}
                   {/* ============== FEATURES TAB (FIXED ALIGNMENT) ============== */}
                   <TabsContent value="features" className="p-6 space-y-4 mt-0">
                            {/* العنوان الرئيسي للتبويب */}
                            <div className="rounded-lg border bg-gradient-to-r from-primary/5 to-primary/10 p-4 text-right">
                                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-primary" />
                                    كيف أقوم بـ...؟
                                </h3>
                                <p className="text-muted-foreground text-sm">
                                    إرشادات خطوة بخطوة لأهم العمليات في النظام
                                </p>
                            </div>

                            <Accordion type="single" collapsible className="w-full text-right" dir="rtl">
                                {featuresGuide.map((feature, index) => (
                                    <AccordionItem key={index} value={`feature-${index}`}>
                                        <AccordionTrigger className="hover:no-underline">
                                            {/* العنوان: الأيقونة يمين، النص يسار (تلقائي في RTL) */}
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-primary/10">
                                                    <feature.icon className="h-4 w-4 text-primary" />
                                                </div>
                                                <span className="font-semibold">{feature.title}</span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-4">
                                            <div className="space-y-4 ps-4 pe-2">
                                                {/* قسم الخطوات */}
                                                <div>
                                                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 ">
                                                        :الخطوات
                                                    </h4>
                                                    <ol className="space-y-3">
                                                        {feature.steps.map((step, sIdx) => (
                                                            <li key={sIdx} className="text-sm flex items-start gap-3 text-right">
                                                                {/* الرقم: سيظهر على اليمين */}
                                                                <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 border border-muted-foreground/20">
                                                                    {sIdx + 1}
                                                                </span>
                                                                {/* النص: سيظهر يسار الرقم */}
                                                                <span className="flex-1 leading-relaxed text-slate-700" dir="auto">
                                                                    {step}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ol>
                                                </div>

                                                {/* قسم النصائح */}
                                                {feature.tips && feature.tips.length > 0 && (
                                                    <div className="mt-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 p-4">
                                                        <h4 className="text-sm font-bold mb-2 flex items-center gap-2 text-blue-700 dark:text-blue-300">
                                                            <Lightbulb className="h-4 w-4" />
                                                            نصائح مفيدة
                                                        </h4>
                                                        <ul className="space-y-2">
                                                            {feature.tips.map((tip, tIdx) => (
                                                                <li key={tIdx} className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
                                                                    <span className="text-blue-400 mt-1.5 h-1.5 w-1.5 rounded-full bg-current block"></span>
                                                                    <span className="flex-1" dir="auto">{tip}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </TabsContent>

                        {/* ============== TIPS TAB ============== */}
                        <TabsContent value="tips" className="p-6 space-y-4 mt-0">
                            <div className="rounded-lg border bg-gradient-to-r from-primary/5 to-primary/10 p-4 text-right">
                                <h3 className="font-semibold text-lg mb-2 flex flex-row-reverse items-center gap-2">
                                    <Lightbulb className="h-5 w-5 text-primary" />
                                    نصائح سريعة
                                </h3>
                                <p className="text-muted-foreground text-sm">
                                    نصائح مختصرة لاستخدام النظام بشكل أفضل وأسرع
                                </p>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {quickTips.map((tip, index) => (
                                    <Card key={index} className="hover:shadow-md transition-shadow text-right">
                                        <CardHeader className="pb-2">
                                            <div className="flex flex-row-reverse items-center gap-2">
                                                <tip.icon className="h-5 w-5 text-primary" />
                                                <CardTitle className="text-base">{tip.title}</CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground">
                                                {tip.desc}
                                            </p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            <Separator className="my-6" />

                            <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 text-right">
                                <CardHeader>
                                    <CardTitle className="flex flex-row-reverse items-center gap-2">
                                        <Settings className="h-5 w-5" />
                                        إعدادات للمدير
                                    </CardTitle>
                                    <CardDescription>
                                        كمدير للنظام، يمكنك تخصيص النظام حسب احتياجات شركتك
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="flex flex-row-reverse items-start gap-3 p-3 rounded-lg bg-background/50">
                                            <Package className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <div className="text-right">
                                                <h4 className="font-medium">المنتجات</h4>
                                                <p className="text-sm text-muted-foreground">أضف وعدّل المنتجات والأسعار الأساسية</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-row-reverse items-start gap-3 p-3 rounded-lg bg-background/50">
                                            <DollarSign className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <div className="text-right">
                                                <h4 className="font-medium">فئات التسعير</h4>
                                                <p className="text-sm text-muted-foreground">أنشئ فئات بنسب ربح مختلفة</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-row-reverse items-start gap-3 p-3 rounded-lg bg-background/50">
                                            <Workflow className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <div className="text-right">
                                                <h4 className="font-medium">حالات الطلبات</h4>
                                                <p className="text-sm text-muted-foreground">خصص ألوان وأسماء الحالات</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-row-reverse items-start gap-3 p-3 rounded-lg bg-background/50">
                                            <Users className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                            <div className="text-right">
                                                <h4 className="font-medium">الفريق</h4>
                                                <p className="text-sm text-muted-foreground">أضف مستخدمين وحدد أدوارهم</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                        </TabsContent>
                    </ScrollArea>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
