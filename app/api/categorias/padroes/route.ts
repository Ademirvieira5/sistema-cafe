import { NextResponse } from "next/server";
import { d1, id, now } from "@/lib/d1";
import { apiError } from "@/lib/api-response";
const defaults=[
 ["FRETE","Fretes","EXPENSE"],["COMISSAO","Comissões","EXPENSE"],["IMPOSTO","Impostos","EXPENSE"],["FUNRURAL","FUNRURAL","EXPENSE"],["SALARIO","Salários e encargos","EXPENSE"],["ESCRITORIO","Escritório","EXPENSE"],["BANCARIA","Despesas bancárias","EXPENSE"],["ALUGUEL","Aluguéis","EXPENSE"],["SEGURO","Seguros","EXPENSE"],["SAQUEIRO","Saqueiros","EXPENSE"],["CONSORCIO","Consórcio","EXPENSE"],["RETIRADA","Retirada de sócio","EXPENSE"],["OUTRA_DESPESA","Outras despesas","EXPENSE"],["OUTRA_RECEITA","Outras receitas","INCOME"]
];
export async function POST(){try{const db=d1(),stamp=now(),existing=await db.prepare("SELECT code FROM financial_categories").all(),codes=new Set(existing.results.map(x=>String(x.code??"")));const missing=defaults.filter(([code])=>!codes.has(code));if(missing.length)await db.batch(missing.map(([code,name,type])=>db.prepare("INSERT INTO financial_categories(id,code,name,type,description,active,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)").bind(id(),code,name,type,"Categoria padrão do Sistema Café",stamp,stamp)));return NextResponse.json({created:missing.length})}catch(error){return apiError(error)}}
