import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowUpRight,
  Trash2,
  Bot as BotIcon,
  Cpu,
  Unplug,
  MessageSquare,
  Activity,
  Blocks,
  Download,
  RefreshCw,
  Sparkles,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { botDisplayName, type BotAIConfig } from "../lib/api";
import {
  useBot,
  useBotApps,
  useDeleteBot,
  useBotAIConfig,
  useSetBotAI,
  useSetBotAIConfig,
  useUpdateBot,
} from "@/hooks/use-bots";
import { useApps } from "@/hooks/use-apps";
import { useAvailableModels } from "@/hooks/use-apps";
import { useBuiltinApps, useMarketplaceApps, useSyncMarketplaceApp } from "@/hooks/use-marketplace";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppIcon } from "../components/app-icon";
import { parseTools } from "../components/tools-display";
import { useConfirm } from "@/components/ui/confirm-dialog";
// ==================== Page ====================

function formatRelativeTime(ts: number) {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - ts * 1000) / 1000);
  if (diff < 0) return "刚刚";
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  return `${Math.floor(diff / 86400)}天前`;
}

export function BotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  // Server state via react-query
  const { data: bot, isLoading: loading } = useBot(id!);
  const { data: installations = [] } = useBotApps(id!);
  const { data: builtinApps = [] } = useBuiltinApps();
  const { data: listedAppsRaw = [] } = useApps({ listing: "listed" });
  const { data: marketplaceApps = [] } = useMarketplaceApps();
  const { data: availableModels = [] } = useAvailableModels();

  // Derived: listed apps excluding builtins, installed app IDs for this bot
  const builtinSlugs = new Set(builtinApps.map((a: any) => a.slug));
  const listedApps = listedAppsRaw.filter((a: any) => !builtinSlugs.has(a.slug));
  const installedOnBot = new Set(installations.map((inst: any) => inst.app_id));
  const marketplaceLoading = false; // All queries load in parallel, handled by isLoading above

  // Mutations
  const updateBotMutation = useUpdateBot();
  const deleteBotMutation = useDeleteBot();
  const setAIMutation = useSetBotAI();
  const syncAppMutation = useSyncMarketplaceApp();

  // Local UI state
  const [syncing, setSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const marketplaceRef = useRef<HTMLDivElement>(null);
  const deleteInFlightRef = useRef(false);

  const handleDeleteBot = async () => {
    if (!bot || deleteInFlightRef.current) return;

    const finishDelete = () => {
      deleteInFlightRef.current = false;
      setIsDeleting(false);
    };

    deleteInFlightRef.current = true;
    setIsDeleting(true);

    try {
      const ok = await confirm({
        title: "删除确认",
        description: "确定要删除此账号？相关转发规则将停止工作。",
        confirmText: "删除",
        variant: "destructive",
      });
      if (!ok) {
        finishDelete();
        return;
      }

      deleteBotMutation.mutate(bot.id, {
        onSuccess: () => {
          toast({ title: "已删除账号" });
          navigate("/dashboard/accounts");
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "删除失败", description: err.message });
        },
        onSettled: finishDelete,
      });
    } catch {
      finishDelete();
    }
  };

  const handleAutoRenewalChange = async (hours: number) => {
    updateBotMutation.mutate(
      { id: bot.id, data: { reminder_hours: hours } },
      {
        onSuccess: () => toast({ title: "已保存" }),
        onError: (e) =>
          toast({ variant: "destructive", title: "保存失败", description: e.message }),
      },
    );
  };

  const handleInstallApp = async (app: any) => {
    if (app.local_id) {
      navigate(`/dashboard/accounts/${id}/install/${app.local_id}`);
      return;
    }
    setSyncing(true);
    syncAppMutation.mutate(app.slug, {
      onSuccess: (synced: any) => navigate(`/dashboard/accounts/${id}/install/${synced.id}`),
      onError: (e) => toast({ variant: "destructive", title: "同步失败", description: e.message }),
      onSettled: () => setSyncing(false),
    });
  };

  if (loading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-3xl" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  if (!bot)
    return (
      <div className="py-20 text-center space-y-4">
        <Unplug className="h-12 w-12 mx-auto opacity-20" />
        <p className="font-bold">未找到账号</p>
        <Button variant="link" asChild>
          <Link to="/dashboard/accounts">返回列表</Link>
        </Button>
      </div>
    );

  return (
    <div className="flex flex-col gap-8 h-full">
      {ConfirmDialog}
      {/* Entity Banner */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        {/* Identity */}
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
            <BotIcon className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {editingDisplayName ? (
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateBotMutation.mutate(
                      { id: bot.id, data: { display_name: displayNameDraft } },
                      {
                        onSuccess: () => {
                          toast({ title: "已保存" });
                          setEditingDisplayName(false);
                        },
                        onError: (err) =>
                          toast({
                            variant: "destructive",
                            title: "保存失败",
                            description: err.message,
                          }),
                      },
                    );
                  }}
                >
                  <Input
                    autoFocus
                    className="h-8 w-48 text-lg font-bold"
                    value={displayNameDraft}
                    onChange={(e) => setDisplayNameDraft(e.target.value)}
                    placeholder={bot.name}
                  />
                  <Button type="submit" variant="ghost" size="icon-sm">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditingDisplayName(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <div className="flex items-center gap-1.5 group/name">
                  <h1 className="text-2xl font-bold tracking-tight">{botDisplayName(bot)}</h1>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover/name:opacity-100 transition-opacity"
                    onClick={() => {
                      setDisplayNameDraft(bot.display_name || "");
                      setEditingDisplayName(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <Badge variant={bot.status === "connected" ? "default" : "destructive"}>
                {bot.status === "connected"
                  ? "运行中"
                  : bot.status === "session_expired"
                    ? "授权过期"
                    : "离线"}
              </Badge>
              {bot.can_send === false ? (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  不可发送
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Cpu className="h-3 w-3" />
              <span className="capitalize">{bot.provider}</span>
              <span className="opacity-40">·</span>
              <span className="font-mono">{bot.id.slice(0, 12)}…</span>
            </div>
            {bot.send_disabled_reason ? (
              <p className="text-xs text-orange-600">{bot.send_disabled_reason}</p>
            ) : null}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/dashboard/accounts/${id}/console`}>
              <MessageSquare className="h-3.5 w-3.5" />
              消息控制台
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/dashboard/accounts/${id}/traces`}>
              <Activity className="h-3.5 w-3.5" />
              消息追踪
            </Link>
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* AI toggle */}
          <div className="flex items-center gap-1.5">
            <Label
              htmlFor={`ai-toggle-${id}`}
              className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI 回复
            </Label>
            <Switch
              id={`ai-toggle-${id}`}
              checked={bot.ai_enabled || false}
              onCheckedChange={(enabled) => {
                setAIMutation.mutate(
                  { botId: id!, enabled },
                  {
                    onSuccess: () => toast({ title: enabled ? "AI 回复已开启" : "AI 回复已关闭" }),
                    onError: (err) =>
                      toast({
                        variant: "destructive",
                        title: "操作失败",
                        description: err.message,
                      }),
                  },
                );
              }}
            />
          </div>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Expiry reminder */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">到期提醒</span>
            <Select
              value={String(bot.reminder_hours || 0)}
              onValueChange={(v) => handleAutoRenewalChange(Number(v))}
            >
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">关闭提醒</SelectItem>
                <SelectItem value="23">到期前 1 小时提醒</SelectItem>
                <SelectItem value="22">到期前 2 小时提醒</SelectItem>
              </SelectContent>
            </Select>
            {bot.reminder_hours > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] text-muted-foreground/60 cursor-help">
                    {bot.last_reminded_at
                      ? `上次 ${formatRelativeTime(bot.last_reminded_at)}`
                      : "尚未提醒"}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs space-y-1">
                  <p>微信 24 小时窗口目前不能静默自动续期，Hub 只会在到期前提醒你回一条消息。</p>
                  <p>
                    上次消息:{" "}
                    {bot.last_msg_at ? new Date(bot.last_msg_at * 1000).toLocaleString() : "无"}
                  </p>
                  <p>
                    上次提醒:{" "}
                    {bot.last_reminded_at
                      ? new Date(bot.last_reminded_at * 1000).toLocaleString()
                      : "无"}
                  </p>
                  <p>
                    下次提醒:{" "}
                    {bot.last_msg_at
                      ? new Date(
                          Math.max(
                            bot.last_msg_at + bot.reminder_hours * 3600,
                            (bot.last_reminded_at || 0) + 3600,
                          ) * 1000,
                        ).toLocaleString()
                      : "等待首条消息"}
                  </p>
                  <p>收到提醒后，在微信里回复任意消息即可刷新窗口。</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          <Separator orientation="vertical" className="h-6 mx-1" />

          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/accounts">返回列表</Link>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="icon-sm"
                aria-label="删除账号"
                disabled={isDeleting}
                onClick={() => void handleDeleteBot()}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>删除账号</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <BotAIConfigCard
        botId={id!}
        availableModels={availableModels}
        aiEnabled={bot.ai_enabled || false}
      />

      {/* Installed Apps + Marketplace */}
      <>
        {/* Installed Apps Section */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">已安装的应用</h2>
          {installations.length === 0 ? (
            <div className="text-center py-16 space-y-3 border-2 border-dashed rounded-xl">
              <Blocks className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">暂无安装的应用</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard/apps">去应用市场看看</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {installations.map((inst) => (
                <Link
                  key={inst.id}
                  to={`/dashboard/accounts/${id}/apps/${inst.id}`}
                  className="group block"
                >
                  <Card className="h-full border-border/50 transition-all hover:border-primary/30 hover:shadow-md">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <AppIcon
                            icon={inst.app_icon}
                            iconUrl={inst.app_icon_url}
                            size="h-9 w-9"
                          />
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                              {inst.app_name}
                            </CardTitle>
                            {inst.handle ? (
                              <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                                @{inst.handle}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <Badge
                          variant={inst.enabled ? "default" : "outline"}
                          className="shrink-0 text-[10px]"
                        >
                          {inst.enabled ? "运行中" : "已停用"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardFooter className="pt-2 pb-4 px-4 flex justify-between items-center border-t border-border/40">
                      <span className="text-[11px] font-mono text-muted-foreground/60">
                        {inst.app_slug}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* App Marketplace Section */}
        <div ref={marketplaceRef} className="space-y-6">
          <h2 className="text-sm font-semibold text-muted-foreground">应用市场</h2>

          {/* Builtin Apps */}
          {!marketplaceLoading && builtinApps.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs text-muted-foreground/60 px-1">内置应用</h3>
              <div className="divide-y divide-border/50 rounded-xl border border-border/50 overflow-hidden">
                {builtinApps.map((app: any) => (
                  <div
                    key={app.slug || app.id}
                    className="group flex items-center gap-4 px-4 py-3.5 bg-card hover:bg-muted/40 transition-colors"
                  >
                    <AppIcon icon={app.icon} iconUrl={app.icon_url} size="h-9 w-9" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold leading-tight">{app.name}</p>
                        {installedOnBot.has(app.id) ? (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            已安装
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {app.description}
                      </p>
                    </div>
                    {parseTools(app.tools).length > 0 ? (
                      <span className="text-[11px] text-muted-foreground/50 shrink-0 hidden sm:block">
                        {parseTools(app.tools).length} 个命令
                      </span>
                    ) : null}
                    {installedOnBot.has(app.id) ? (
                      <span className="text-[11px] text-muted-foreground/50 shrink-0">已安装</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1.5"
                        onClick={() => navigate(`/dashboard/accounts/${id}/install/${app.id}`)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        安装
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Listed Apps */}
          {!marketplaceLoading && listedApps.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs text-muted-foreground/60 px-1">推荐应用</h3>
              <div className="divide-y divide-border/50 rounded-xl border border-border/50 overflow-hidden">
                {listedApps.map((app: any) => (
                  <div
                    key={app.id}
                    className="group flex items-center gap-4 px-4 py-3.5 bg-card hover:bg-muted/40 transition-colors"
                  >
                    <AppIcon icon={app.icon} iconUrl={app.icon_url} size="h-9 w-9" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold leading-tight truncate">{app.name}</p>
                        {app.version ? (
                          <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                            v{app.version}
                          </Badge>
                        ) : null}
                        {installedOnBot.has(app.id) ? (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            已安装
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {app.description}
                      </p>
                    </div>
                    {installedOnBot.has(app.id) ? (
                      <span className="text-[11px] text-muted-foreground/50 shrink-0">已安装</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1.5"
                        onClick={() => navigate(`/dashboard/accounts/${id}/install/${app.id}`)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        安装
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Marketplace Apps */}
          {!marketplaceLoading && marketplaceApps.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs text-muted-foreground/60 px-1">远程市场</h3>
              <div className="divide-y divide-border/50 rounded-xl border border-border/50 overflow-hidden">
                {marketplaceApps.map((app) => (
                  <div
                    key={app.slug || app.id}
                    className="group flex items-center gap-4 px-4 py-3.5 bg-card hover:bg-muted/40 transition-colors"
                  >
                    <AppIcon icon={app.icon} iconUrl={app.icon_url} size="h-9 w-9" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold leading-tight truncate">{app.name}</p>
                        {app.version ? (
                          <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                            v{app.version}
                          </Badge>
                        ) : null}
                        {app.installed ? (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            已安装
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {app.description || "暂无描述"}
                      </p>
                    </div>
                    {app.author ? (
                      <span className="text-[11px] text-muted-foreground/50 shrink-0 hidden sm:block">
                        {app.author}
                      </span>
                    ) : null}
                    {app.installed && app.update_available ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1.5"
                        disabled={syncing}
                        onClick={() => handleInstallApp(app)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        更新
                      </Button>
                    ) : app.installed ? (
                      <span className="text-[11px] text-muted-foreground/50 shrink-0">已安装</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1.5"
                        disabled={syncing}
                        onClick={() => handleInstallApp(app)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        安装
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </>
    </div>
  );
}

const emptyBotAIConfig: BotAIConfig = {
  source: "global",
  base_url: "",
  api_key: "",
  model: "",
  model_override: "",
  system_prompt: "",
  max_history: 20,
  hide_thinking: false,
  strip_markdown: false,
  custom_headers: {},
};

function BotAIConfigCard({
  botId,
  availableModels,
  aiEnabled,
}: {
  botId: string;
  availableModels: string[];
  aiEnabled: boolean;
}) {
  const { data, isLoading } = useBotAIConfig(botId);
  const saveConfig = useSetBotAIConfig();
  const { toast } = useToast();
  const [form, setForm] = useState<BotAIConfig>(emptyBotAIConfig);
  const [headersText, setHeadersText] = useState("{}");

  useEffect(() => {
    if (!data) return;
    setForm({ ...emptyBotAIConfig, ...data, custom_headers: data.custom_headers || {} });
    setHeadersText(JSON.stringify(data.custom_headers || {}, null, 2));
  }, [data]);

  const update = <K extends keyof BotAIConfig>(key: K, value: BotAIConfig[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function handleSave() {
    let customHeaders: Record<string, string> = {};
    try {
      const parsed = headersText.trim() ? JSON.parse(headersText) : {};
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error();
      customHeaders = Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, String(value)]),
      );
    } catch {
      toast({
        variant: "destructive",
        title: "Headers 格式错误",
        description: "请输入 JSON 对象。",
      });
      return;
    }

    saveConfig.mutate(
      { botId, config: { ...form, custom_headers: customHeaders } },
      {
        onSuccess: () => toast({ title: "Bot AI 配置已保存" }),
        onError: (error) =>
          toast({ variant: "destructive", title: "保存失败", description: error.message }),
      },
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI 配置
        </CardTitle>
        <CardDescription>
          {aiEnabled
            ? "为当前 Bot 继承系统默认设置，或配置独立的 OpenAI 兼容接口。"
            : "AI 回复当前已关闭；你仍可先完成配置，保存后再开启。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5 max-w-sm">
          <Label>配置来源</Label>
          <Select
            value={form.source}
            onValueChange={(value) => update("source", value as BotAIConfig["source"])}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">继承全局配置</SelectItem>
              <SelectItem value="custom">当前 Bot 独立配置</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <datalist id={`ai-models-${botId}`}>
          {availableModels.filter(Boolean).map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>

        {form.source === "global" ? (
          <div className="space-y-1.5 max-w-md">
            <Label>模型覆盖（可选）</Label>
            <Input
              list={`ai-models-${botId}`}
              value={form.model_override}
              onChange={(event) => update("model_override", event.target.value)}
              placeholder="留空则使用全局默认模型"
            />
            <p className="text-xs text-muted-foreground">
              接口地址、API Key 和其他参数继续使用管理员配置。
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label>接口地址</Label>
                <Input
                  value={form.base_url}
                  onChange={(event) => update("base_url", event.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div className="space-y-1.5">
                <Label>模型</Label>
                <Input
                  list={`ai-models-${botId}`}
                  value={form.model}
                  onChange={(event) => update("model", event.target.value)}
                  placeholder="gpt-4o-mini"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={form.api_key}
                  onChange={(event) => update("api_key", event.target.value)}
                  placeholder="sk-..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>历史消息轮数</Label>
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={form.max_history}
                  onChange={(event) => update("max_history", Number(event.target.value))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>系统提示词</Label>
              <Textarea
                rows={4}
                value={form.system_prompt}
                onChange={(event) => update("system_prompt", event.target.value)}
                placeholder="设置这个 Bot 的角色和回复要求"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor={`hide-thinking-${botId}`}>隐藏思考过程</Label>
                <Switch
                  id={`hide-thinking-${botId}`}
                  checked={form.hide_thinking}
                  onCheckedChange={(value) => update("hide_thinking", value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor={`strip-markdown-${botId}`}>Markdown 转纯文本</Label>
                <Switch
                  id={`strip-markdown-${botId}`}
                  checked={form.strip_markdown}
                  onCheckedChange={(value) => update("strip_markdown", value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>自定义 Headers（JSON）</Label>
              <Textarea
                rows={4}
                className="font-mono text-xs"
                value={headersText}
                onChange={(event) => setHeadersText(event.target.value)}
                placeholder={'{"HTTP-Referer":"https://example.com"}'}
              />
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end border-t bg-muted/20 pt-4">
        <Button onClick={handleSave} disabled={isLoading || saveConfig.isPending}>
          {saveConfig.isPending ? "保存中…" : "保存 AI 配置"}
        </Button>
      </CardFooter>
    </Card>
  );
}
