import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const variables = [
  {
    name: "{{current_datetime}}",
    example: "[2026-08-31 22:30 周一]",
    description: "当前消息的完整北京时间",
  },
  { name: "{{current_date}}", example: "2026-08-31", description: "当前北京时间日期" },
  { name: "{{current_time}}", example: "22:30", description: "当前北京时间时刻" },
  { name: "{{current_weekday}}", example: "周一", description: "当前北京时间星期" },
  { name: "{{timezone}}", example: "北京时间（UTC+8）", description: "当前使用的时区" },
  { name: "{{bot_id}}", example: "bot-...", description: "当前 Bot ID" },
  { name: "{{user_id}}", example: "user-...", description: "当前对话用户 ID" },
];

export function SystemPromptVariablesDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
          <CircleHelp className="h-3.5 w-3.5" />
          动态参数
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>System Prompt 动态参数</DialogTitle>
          <DialogDescription>
            在系统提示词中填写以下占位符。每次请求 AI 时会自动替换，时间参数统一使用北京时间。
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto rounded-lg border">
          <div className="grid min-w-[620px] grid-cols-[minmax(170px,1fr)_minmax(180px,1fr)_1fr] gap-3 bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span>动态参数</span>
            <span>示例值</span>
            <span>说明</span>
          </div>
          {variables.map((variable) => (
            <div
              key={variable.name}
              className="grid min-w-[620px] grid-cols-[minmax(170px,1fr)_minmax(180px,1fr)_1fr] gap-3 border-t px-4 py-3 text-sm"
            >
              <code className="break-all text-primary">{variable.name}</code>
              <code className="break-all text-xs">{variable.example}</code>
              <span className="text-muted-foreground">{variable.description}</span>
            </div>
          ))}
        </div>
        <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
          <p className="font-medium">示例</p>
          <code className="block whitespace-pre-wrap break-words text-xs text-muted-foreground">
            {"当前时间是 {{current_datetime}}。你正在与用户 {{user_id}} 对话。"}
          </code>
        </div>
      </DialogContent>
    </Dialog>
  );
}
