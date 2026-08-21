export type ReportDirection="PAYABLE"|"RECEIVABLE";

export function funruralCompetence(issueDate:string){return issueDate.slice(0,7)}

export function funruralDueDate(issueDate:string){
 const[year,month]=issueDate.slice(0,7).split("-").map(Number),nextMonth=month===12?1:month+1,nextYear=month===12?year+1:year;
 return `${nextYear}-${String(nextMonth).padStart(2,"0")}-20`;
}

export function funruralReconciliationStatus(calculatedCents:number,guideCents:number|null,paidCents:number){
  if(guideCents==null)return"WAITING_GUIDE" as const;
  if(Math.abs(guideCents-calculatedCents)>1)return"DIFFERENCE" as const;
  if(paidCents>=calculatedCents&&calculatedCents>0)return"PAID" as const;
  return"CONFIRMED" as const;
}

export function normalizeReportDirection(value?:string|null):ReportDirection|null{
  return value==="PAYABLE"||value==="RECEIVABLE"?value:null;
}

export function normalizeOptionalFilter(value?:string|null):string|null{
  const normalized=value?.trim();
  return normalized?normalized:null;
}

export function addMonthsDate(value:string,months:number){
  const[year,month,day]=value.split("-").map(Number),target=new Date(Date.UTC(year,month-1+months,1)),lastDay=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
  return`${target.getUTCFullYear()}-${String(target.getUTCMonth()+1).padStart(2,"0")}-${String(Math.min(day,lastDay)).padStart(2,"0")}`;
}

export function monthlyDueDates(start:string,count=12){
  return Array.from({length:count},(_,index)=>addMonthsDate(start,index));
}

export function nextRecurringTax(operationKey:string|null|undefined,dueDate:string,description:string){
  const match=String(operationKey||"").match(/^RECURRING_TAX:([A-Z_]+):(\d{4}-\d{2})$/);if(!match)return null;
  const nextCompetence=addMonthsDate(`${match[2]}-01`,1).slice(0,7),[year,month]=nextCompetence.split("-");
  return{operationKey:`RECURRING_TAX:${match[1]}:${nextCompetence}`,dueDate:addMonthsDate(dueDate,1),description:description.replace(/\b\d{2}\/\d{4}\b/,`${month}/${year}`)};
}

export function calculateCoffeeTotals(effectiveKilograms:number,pricePerSack:number,adjustmentCents:number,commissionMode:"PERCENT"|"AMOUNT",commissionValue:number,hasBroker:boolean){
  const grossCents=Math.round((effectiveKilograms/60)*pricePerSack*100),totalCents=grossCents+adjustmentCents;
  const commissionCents=hasBroker?(commissionMode==="PERCENT"?Math.round(totalCents*commissionValue/100):Math.round(commissionValue*100)):0;
  return{grossCents,totalCents,commissionCents};
}

export function calculateMonthlyInventory(openingKilogramsMilli:number,openingValueCents:number,purchaseKilogramsMilli:number,purchaseValueCents:number,saleKilogramsMilli:number,saleRevenueCents:number){
  const availableKilogramsMilli=openingKilogramsMilli+purchaseKilogramsMilli,availableValueCents=openingValueCents+purchaseValueCents;
  const averageCostPerKilogramMilli=availableKilogramsMilli>0?availableValueCents/availableKilogramsMilli:0;
  const costOfGoodsSoldCents=Math.round(saleKilogramsMilli*averageCostPerKilogramMilli);
  const closingKilogramsMilli=availableKilogramsMilli-saleKilogramsMilli,closingValueCents=availableValueCents-costOfGoodsSoldCents;
  return{availableKilogramsMilli,availableValueCents,averageCostPerKilogramMilli,costOfGoodsSoldCents,closingKilogramsMilli,closingValueCents,grossProfitCents:saleRevenueCents-costOfGoodsSoldCents,hasStockCoverage:saleKilogramsMilli<=availableKilogramsMilli};
}

export function calculatePhysicalClosingInventory(openingKilogramsMilli:number,openingValueCents:number,purchaseKilogramsMilli:number,purchaseValueCents:number,saleKilogramsMilli:number,saleRevenueCents:number,reportedClosingKilogramsMilli:number|null,reportedPricePerSackCents:number|null=null){
  const availableKilogramsMilli=openingKilogramsMilli+purchaseKilogramsMilli,availableValueCents=openingValueCents+purchaseValueCents,averageCostPerKilogramMilli=availableKilogramsMilli>0?availableValueCents/availableKilogramsMilli:0,theoreticalClosingKilogramsMilli=availableKilogramsMilli-saleKilogramsMilli;
  const isClosed=reportedClosingKilogramsMilli!==null&&reportedPricePerSackCents!==null&&reportedPricePerSackCents>0,closingKilogramsMilli=isClosed?reportedClosingKilogramsMilli!:theoreticalClosingKilogramsMilli,closingPricePerSackCents=isClosed?reportedPricePerSackCents!:Math.round(averageCostPerKilogramMilli*60000),closingValueCents=isClosed?Math.round((closingKilogramsMilli/60000)*closingPricePerSackCents):Math.round(closingKilogramsMilli*averageCostPerKilogramMilli),costOfGoodsSoldCents=availableValueCents-closingValueCents;
  return{availableKilogramsMilli,availableValueCents,averageCostPerKilogramMilli,theoreticalClosingKilogramsMilli,closingKilogramsMilli,closingPricePerSackCents,closingValueCents,costOfGoodsSoldCents,grossProfitCents:saleRevenueCents-costOfGoodsSoldCents,physicalAdjustmentKilogramsMilli:closingKilogramsMilli-theoreticalClosingKilogramsMilli,isClosed,hasStockCoverage:closingKilogramsMilli>=0&&closingKilogramsMilli<=availableKilogramsMilli};
}
