import { NextResponse } from "next/server";
import { d1, money } from "@/lib/d1";
import { apiError } from "@/lib/api-response";

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); };

export async function GET() {
  try {
    const db = d1(); const current = today(); const next = plusDays(7);
    const rows = await db.prepare(`
      SELECT due_date date, direction, (amount_cents-paid_amount_cents) amount, description, origin FROM (
        SELECT due_date, 'PAYABLE' direction, amount_cents, paid_amount_cents, description, 'Conta geral' origin
        FROM general_entries WHERE active=1 AND amount_cents>paid_amount_cents
        UNION ALL
        SELECT i.due_date, CASE WHEN d.business_type='PURCHASE' THEN 'PAYABLE' ELSE 'RECEIVABLE' END,
          i.amount_cents, i.paid_amount_cents, 'Negócio de café #' || printf('%05d',d.sequence), 'Café'
        FROM installments i JOIN deals d ON d.id=i.deal_id
        WHERE d.status='OPEN' AND i.amount_cents>i.paid_amount_cents
      ) ORDER BY due_date LIMIT 300`).all();
    const all = rows.results.map(row => ({ date:String(row.date), direction:String(row.direction), amount:Number(row.amount), description:String(row.description), origin:String(row.origin) }));
    const total = (list: typeof all, direction: string) => list.filter(item => item.direction === direction).reduce((sum,item) => sum + item.amount, 0);
    const group = (list: typeof all) => ({ count:list.length, payable:money(total(list,"PAYABLE")), receivable:money(total(list,"RECEIVABLE")) });
    const overdue=all.filter(item=>item.date<current), dueToday=all.filter(item=>item.date===current), upcoming=all.filter(item=>item.date>current&&item.date<=next);
    return NextResponse.json({ today:current, overdue:group(overdue), dueToday:{...group(dueToday),items:dueToday.map(item=>({...item,amount:money(item.amount)}))}, upcoming:group(upcoming) });
  } catch (error) { return apiError(error); }
}
