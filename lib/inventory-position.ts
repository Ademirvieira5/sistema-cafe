import { cents,d1,id,kilograms,money,now } from "@/lib/d1";
import { calculatePhysicalClosingInventory } from "@/lib/financial-rules";
import { inventoryClosingSchema,inventorySettingSchema } from "@/lib/validation";

const monthPattern=/^\d{4}-(0[1-9]|1[0-2])$/;
const endOfMonth=(month:string)=>{const[year,value]=month.split("-").map(Number);return new Date(Date.UTC(year,value,0)).toISOString().slice(0,10)};
const nextMonth=(month:string)=>{const[year,value]=month.split("-").map(Number),date=new Date(Date.UTC(year,value,1));return date.toISOString().slice(0,7)};
const previousMonth=(month:string)=>{const[year,value]=month.split("-").map(Number),date=new Date(Date.UTC(year,value-2,1));return date.toISOString().slice(0,7)};
const sacks=(kilogramsMilli:number)=>(kilogramsMilli/60000).toFixed(3);
const movement=(row:Record<string,unknown>)=>({id:String(row.id),sequence:Number(row.sequence),date:String(row.date),party:String(row.legal_name),kilograms:kilograms(Number(row.kilograms_milli)),sacks:sacks(Number(row.kilograms_milli)),amount:money(Number(row.total_amount_cents))});

export async function saveInventorySetting(input:unknown){
  const data=inventorySettingSchema.parse(input),db=d1(),stamp=now(),kilogramsMilli=Math.round(Number(data.openingKilograms)*1000),pricePerSackCents=cents(data.openingPricePerSack),valueCents=Math.round((kilogramsMilli/60000)*pricePerSackCents);
  await db.batch([
    db.prepare("INSERT INTO inventory_settings(id,start_month,opening_kilograms_milli,opening_value_cents,created_at,updated_at) VALUES('main',?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET start_month=excluded.start_month,opening_kilograms_milli=excluded.opening_kilograms_milli,opening_value_cents=excluded.opening_value_cents,updated_at=excluded.updated_at").bind(data.startMonth,kilogramsMilli,valueCents,stamp,stamp),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'InventorySettings','main','UPDATE',?,?)").bind(id(),JSON.stringify({firstCalculatedMonth:data.startMonth,previousClosingKilograms:data.openingKilograms,previousClosingPricePerSack:data.openingPricePerSack,previousClosingValue:money(valueCents)}),stamp),
  ]);
  return{ok:true};
}

export async function saveInventoryClosing(input:unknown){
  const data=inventoryClosingSchema.parse(input),db=d1(),stamp=now(),kilogramsMilli=Math.round(Number(data.closingKilograms)*1000),pricePerSackCents=cents(data.closingPricePerSack);
  await db.batch([
    db.prepare("INSERT INTO inventory_month_closings(month,closing_kilograms_milli,closing_price_per_sack_cents,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(month) DO UPDATE SET closing_kilograms_milli=excluded.closing_kilograms_milli,closing_price_per_sack_cents=excluded.closing_price_per_sack_cents,updated_at=excluded.updated_at").bind(data.month,kilogramsMilli,pricePerSackCents,stamp,stamp),
    db.prepare("INSERT INTO audit_logs(id,entity_type,entity_id,action,after_data,created_at) VALUES(?,'InventoryMonthClosing',?,'UPDATE',?,?)").bind(id(),data.month,JSON.stringify({closingKilograms:data.closingKilograms,closingPricePerSack:data.closingPricePerSack}),stamp),
  ]);
  return{ok:true};
}

export async function inventoryPosition(month:string){
  if(!monthPattern.test(month))throw new Error("INVALID_MONTH");
  const db=d1(),setting=await db.prepare("SELECT * FROM inventory_settings WHERE id='main'").first<Record<string,unknown>>(),rangeEnd=endOfMonth(month);
  const rangeStart=setting?`${String(setting.start_month)}-01`:`${month}-01`;
  const[dealResult,closingResult]=await Promise.all([
    db.prepare("SELECT d.id,d.sequence,d.business_type,d.date,d.kilograms_milli,d.total_amount_cents,d.commission_amount_cents,p.legal_name FROM deals d JOIN people p ON p.id=d.party_id WHERE d.status='OPEN' AND d.date BETWEEN ? AND ? ORDER BY d.date,d.sequence").bind(rangeStart,rangeEnd).all(),
    setting?db.prepare("SELECT month,closing_kilograms_milli,closing_price_per_sack_cents FROM inventory_month_closings WHERE month BETWEEN ? AND ? ORDER BY month").bind(String(setting.start_month),month).all():Promise.resolve({results:[]} as D1Result<unknown>),
  ]);
  const current=dealResult.results.filter(row=>String(row.date).slice(0,7)===month),purchases=current.filter(row=>row.business_type==="PURCHASE"),sales=current.filter(row=>row.business_type==="SALE");
  const generalExpenses=await db.prepare("SELECT COALESCE(SUM(amount_cents),0) total FROM general_entries WHERE active=1 AND direction='PAYABLE' AND due_date BETWEEN ? AND ?").bind(`${month}-01`,rangeEnd).first<{total:number}>();
  const openingQuantity=Number(setting?.opening_kilograms_milli??0),openingTotal=Number(setting?.opening_value_cents??0),settingView=setting?{startMonth:String(setting.start_month),previousMonth:previousMonth(String(setting.start_month)),openingKilograms:kilograms(openingQuantity),openingSacks:sacks(openingQuantity),openingPricePerSack:money(openingQuantity>0?Math.round(openingTotal*60000/openingQuantity):0),openingValue:money(openingTotal)}:null;
  if(!setting||month<String(setting.start_month))return{configured:Boolean(setting),beforeStart:Boolean(setting),missingClosingMonth:null,month,setting:settingView,summary:null,purchases:purchases.map(movement),sales:sales.map(movement)};
  const closings=new Map(closingResult.results.map(row=>{const record=row as Record<string,unknown>;return[String(record.month),{kilogramsMilli:Number(record.closing_kilograms_milli),pricePerSackCents:Number(record.closing_price_per_sack_cents)}]}));
  let openingKilogramsMilli=Number(setting.opening_kilograms_milli),openingValueCents=Number(setting.opening_value_cents),cursor=String(setting.start_month),selected:ReturnType<typeof calculatePhysicalClosingInventory>|null=null,selectedInput={purchaseKilogramsMilli:0,purchaseValueCents:0,saleKilogramsMilli:0,saleRevenueCents:0};
  while(cursor<=month){
    const rows=dealResult.results.filter(row=>String(row.date).slice(0,7)===cursor),purchaseRows=rows.filter(row=>row.business_type==="PURCHASE"),saleRows=rows.filter(row=>row.business_type==="SALE");
    selectedInput={purchaseKilogramsMilli:purchaseRows.reduce((sum,row)=>sum+Number(row.kilograms_milli),0),purchaseValueCents:purchaseRows.reduce((sum,row)=>sum+Number(row.total_amount_cents),0),saleKilogramsMilli:saleRows.reduce((sum,row)=>sum+Number(row.kilograms_milli),0),saleRevenueCents:saleRows.reduce((sum,row)=>sum+Number(row.total_amount_cents),0)};
    const reported=closings.get(cursor)??null;
    selected=calculatePhysicalClosingInventory(openingKilogramsMilli,openingValueCents,selectedInput.purchaseKilogramsMilli,selectedInput.purchaseValueCents,selectedInput.saleKilogramsMilli,selectedInput.saleRevenueCents,reported?.kilogramsMilli??null,reported?.pricePerSackCents??null);
    if(cursor===month)break;
    if(!selected.isClosed)return{configured:true,beforeStart:false,missingClosingMonth:cursor,month,setting:settingView,summary:null,purchases:purchases.map(movement),sales:sales.map(movement)};
    openingKilogramsMilli=selected.closingKilogramsMilli;openingValueCents=selected.closingValueCents;cursor=nextMonth(cursor);
  }
  const commissionsCents=current.reduce((sum,row)=>sum+Number(row.commission_amount_cents),0),expensesCents=Number(generalExpenses?.total??0),resultCents=(selected?.grossProfitCents??0)-commissionsCents-expensesCents;
  return{configured:true,beforeStart:false,missingClosingMonth:null,month,setting:settingView,summary:{isClosed:selected?.isClosed??false,openingKilograms:kilograms(openingKilogramsMilli),openingSacks:sacks(openingKilogramsMilli),openingValue:money(openingValueCents),purchaseKilograms:kilograms(selectedInput.purchaseKilogramsMilli),purchaseSacks:sacks(selectedInput.purchaseKilogramsMilli),purchaseValue:money(selectedInput.purchaseValueCents),saleKilograms:kilograms(selectedInput.saleKilogramsMilli),saleSacks:sacks(selectedInput.saleKilogramsMilli),saleRevenue:money(selectedInput.saleRevenueCents),averageCostPerSack:money(Math.round((selected?.averageCostPerKilogramMilli??0)*60000)),costOfGoodsSold:money(selected?.costOfGoodsSoldCents??0),theoreticalClosingKilograms:kilograms(selected?.theoreticalClosingKilogramsMilli??0),theoreticalClosingSacks:sacks(selected?.theoreticalClosingKilogramsMilli??0),closingKilograms:kilograms(selected?.closingKilogramsMilli??0),closingSacks:sacks(selected?.closingKilogramsMilli??0),closingPricePerSack:money(selected?.closingPricePerSackCents??0),closingValue:money(selected?.closingValueCents??0),physicalAdjustmentKilograms:kilograms(selected?.physicalAdjustmentKilogramsMilli??0),physicalAdjustmentSacks:sacks(selected?.physicalAdjustmentKilogramsMilli??0),grossProfit:money(selected?.grossProfitCents??0),generalExpenses:money(expensesCents),commissions:money(commissionsCents),operatingResult:money(resultCents),hasStockCoverage:selected?.hasStockCoverage??true},purchases:purchases.map(movement),sales:sales.map(movement)};
}
