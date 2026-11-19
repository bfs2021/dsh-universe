// Matching data for the session theme: Chinese and English word lists per tag,
// matched against the session title on this device only. This is data for matching, not interface text
// (scripts/check-no-inline-text.mjs allows this file by name). English words match at word starts; Chinese words
// match anywhere. Lower case only.
import type { Tag } from './theme.ts';

export const THEME_WORDS: Readonly<Record<Tag, { zh: readonly string[]; en: readonly string[] }>> = {
  finance: { zh: ['发票', '对账', '报销', '财务', '账款', '应收', '应付', '账龄', '流水', '预算', '税', '费用', '账单', '回款', '审计'], en: ['invoice', 'ledger', 'expense', 'reconcil', 'financ', 'receivable', 'payable', 'budget', 'tax', 'billing', 'payment', 'accounting', 'audit'] },
  sales: { zh: ['报价', '客户', '线索', '销售', '询价', '商机', '订单', '拜访'], en: ['quot', 'customer', 'lead', 'sales', 'deal', 'prospect', 'order', 'crm'] },
  code: { zh: ['脚本', '编码', '代码', '修复', '接口', '部署', '编译', '重构', '测试'], en: ['script', 'code', 'bug', 'fix', 'api', 'deploy', 'build', 'refactor', 'test', 'export', 'debug'] },
  docs: { zh: ['纪要', '摘要', '文档', '办法', '周报', '草稿', '说明', '目录', '整理'], en: ['notes', 'summary', 'doc', 'report draft', 'draft', 'readme', 'outline', 'minutes'] },
  research: { zh: ['调研', '研究', '竞品', '分析', '公告', '资料'], en: ['research', 'study', 'competitor', 'analysis', 'investigat', 'survey'] },
  design: { zh: ['设计', '原型', '海报', '界面', '配色', '排版'], en: ['design', 'mockup', 'prototyp', 'poster', 'layout', 'logo', 'figma'] },
  data: { zh: ['表格', '数据', '合并', '统计', '报表', '清单'], en: ['sheet', 'data', 'merge', 'csv', 'excel', 'table', 'dashboard', 'metric'] },
  legal: { zh: ['投标', '标书', '合同', '评分', '条款', '资质', '保证金', '法务', '协议'], en: ['bid', 'contract', 'tender', 'clause', 'legal', 'agreement', 'compliance', 'licen'] },
  ops: { zh: ['库存', '预警', '日报', '运营', '排班', '物流', '寄送', '盘点'], en: ['stock', 'alert', 'daily', 'inventory', 'ops', 'operation', 'logistic', 'shipping'] },
  media: { zh: ['视频', '剪辑', '图片', '音频', '直播', '素材'], en: ['video', 'edit clip', 'image', 'audio', 'podcast', 'stream', 'footage'] },
  support: { zh: ['客服', '工单', '答疑', '投诉', '售后', '回复'], en: ['support', 'ticket', 'helpdesk', 'complaint', 'faq', 'reply'] },
  hr: { zh: ['招聘', '面试', '简历', '入职', '人事', '考勤', '绩效'], en: ['hiring', 'recruit', 'interview', 'resume', 'onboard', 'payroll', 'hr'] },
  marketing: { zh: ['营销', '推广', '文案', '活动', '品牌', '公众号'], en: ['marketing', 'campaign', 'promo', 'copywrit', 'brand', 'newsletter', 'seo'] },
  product: { zh: ['需求', '产品', '路线图', '版本', '迭代', '用户故事'], en: ['product', 'roadmap', 'requirement', 'feature', 'release', 'spec', 'backlog'] },
  security: { zh: ['安全', '漏洞', '权限', '密码', '加密', '风控'], en: ['security', 'vulnerab', 'permission', 'password', 'encrypt', 'risk'] },
  admin: { zh: ['行政', '会议', '待办', '日程', '差旅', '采购', '重命名', '文件夹'], en: ['admin', 'meeting', 'todo', 'schedule', 'travel', 'purchas', 'rename', 'folder'] },
};
