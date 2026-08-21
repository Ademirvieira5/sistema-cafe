import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown) {
  if (error instanceof Error && error.message === "XML_DOCUMENT_NOT_FOUND") return NextResponse.json({ error: "O XML não foi encontrado." }, { status: 404 });
  if (error instanceof Error && error.message === "XML_FILE_NOT_FOUND") return NextResponse.json({ error: "O arquivo XML original não está mais disponível." }, { status: 404 });
  if (error instanceof Error && error.message === "XML_ALREADY_LINKED") return NextResponse.json({ error: "Este XML já está vinculado a outro lançamento." }, { status: 409 });
  if (error instanceof Error && error.message === "XML_LINK_NOT_FOUND") return NextResponse.json({ error: "Este XML não está mais vinculado a este negócio. Atualize a tela." }, { status: 409 });
  if (error instanceof Error && error.message === "XML_RETURN_HAS_FINANCIAL_ENTRY") return NextResponse.json({ error: "Esta devolução gerou uma conta financeira. Cancele primeiro a conta da devolução antes de desvincular o XML." }, { status: 409 });
  if (error instanceof Error && error.message === "XML_DELETE_LINKED") return NextResponse.json({ error: "Este XML possui vínculo financeiro ou fiscal. Desfaça o vínculo antes de excluir." }, { status: 409 });
  if (error instanceof Error && error.message === "XML_EXPENSE_INVALID") return NextResponse.json({ error: "Somente NF-e de compra para uso da empresa pode ser lançada por esta opção." }, { status: 400 });
  if (error instanceof Error && error.message === "XML_DEAL_MISMATCH") return NextResponse.json({ error: "O negócio selecionado não pertence à mesma pessoa ou não é do mesmo tipo da nota." }, { status: 400 });
  if (error instanceof Error && error.message === "RETURN_DEAL_MISMATCH") return NextResponse.json({ error: "Esta devolução não pertence ao cliente da venda selecionada." }, { status: 400 });
  if (error instanceof Error && error.message === "FISCAL_DIFFERENCE_NOT_FOUND") return NextResponse.json({ error: "Esta venda não possui diferença fiscal em aberto para receber devolução." }, { status: 400 });
  if (error instanceof Error && error.message === "RETURN_EXCEEDS_FISCAL_DIFFERENCE") return NextResponse.json({ error: "O valor desta NF-e de devolução é maior que a diferença fiscal ainda em aberto." }, { status: 400 });
  if (error instanceof Error && error.message === "XML_STORAGE_UNAVAILABLE") return NextResponse.json({ error: "O armazenamento de XMLs está temporariamente indisponível." }, { status: 503 });
  if (error instanceof Error && ["XML_NFE_NOT_FOUND", "XML_ACCESS_KEY_INVALID", "XML_PARTY_INVALID", "XML_PARTY_DOCUMENT_MISSING", "XML_DATE_INVALID", "XML_UNSAFE"].includes(error.message)) return NextResponse.json({ error: "O arquivo não contém uma NF-e válida ou está incompleto." }, { status: 400 });
  if (error instanceof Error && error.message === "XML_TOO_LARGE") return NextResponse.json({ error: "Cada XML deve ter no máximo 5 MB." }, { status: 400 });
  if (error instanceof Error && error.message === "PDF_DOCUMENT_NOT_FOUND") return NextResponse.json({ error: "O documento PDF não foi encontrado." }, { status: 404 });
  if (error instanceof Error && error.message === "PDF_FILE_NOT_FOUND") return NextResponse.json({ error: "O arquivo PDF original não está disponível." }, { status: 404 });
  if (error instanceof Error && error.message === "PDF_STORAGE_UNAVAILABLE") return NextResponse.json({ error: "O armazenamento de documentos está temporariamente indisponível." }, { status: 503 });
  if (error instanceof Error && error.message === "PDF_REVIEW_REQUIRED") return NextResponse.json({ error: "Confira descrição, vencimento e valor antes de criar a conta." }, { status: 400 });
  if (error instanceof Error && error.message === "CHEQUE_NOT_FOUND") return NextResponse.json({ error: "Cheque não encontrado." }, { status: 404 });
  if (error instanceof Error && error.message === "CHEQUE_STATUS_INVALID") return NextResponse.json({ error: "Esta ação não é permitida na situação atual do cheque. Atualize a carteira e tente novamente." }, { status: 409 });
  if (error instanceof Error && error.message === "CHEQUE_RECEIVABLE_INVALID") return NextResponse.json({ error: "A conta a receber selecionada não está aberta ou não aceita este cheque." }, { status: 400 });
  if (error instanceof Error && error.message === "CHEQUE_PAYABLE_INVALID") return NextResponse.json({ error: "Selecione uma conta a pagar aberta para transferir o cheque." }, { status: 400 });
  if (error instanceof Error && error.message === "PARTIAL_CHEQUE_BATCH") return NextResponse.json({ error: "Parte deste lote já foi salva. Atualize a carteira antes de tentar novamente." }, { status: 409 });
  if(error instanceof Error&&error.message==="INVALID_MONTH")return NextResponse.json({error:"Mês inválido."},{status:400});
  if (error instanceof Error && error.message === "INSTALLMENT_TOTAL") {
    return NextResponse.json({ error: "A soma das parcelas deve ser igual ao valor total da negociação." }, { status: 400 });
  }
  if (error instanceof Error && error.message.includes("SETTLEMENT_EXCEEDS_BALANCE")) {
    return NextResponse.json({ error: "O valor da baixa é maior que o saldo em aberto." }, { status: 400 });
  }
  if (error instanceof Error && error.message === "OWN_CHECK_DUPLICATE") return NextResponse.json({ error: "Um destes números de cheque já foi usado nesta conta bancária." }, { status: 409 });
  if (error instanceof Error && error.message === "OWN_CHECK_PAYABLE_ONLY") return NextResponse.json({ error: "O lote de cheques próprios só pode ser usado para contas a pagar." }, { status: 400 });
  if (error instanceof Error && error.message === "ORIGIN_NOT_FOUND") {
    return NextResponse.json({ error: "A conta não foi encontrada ou não está mais aberta." }, { status: 404 });
  }
  if (error instanceof Error && error.message === "BANK_ACCOUNT_NOT_FOUND") {
    return NextResponse.json({ error: "A conta bancária não existe ou está inativa." }, { status: 400 });
  }
  if (error instanceof Error && error.message === "BROKER_NOT_FOUND") {
    return NextResponse.json({ error: "O corretor não foi encontrado ou está inativo." }, { status: 404 });
  }
  if (error instanceof Error && error.message === "DUPLICATE_BROKER") {
    return NextResponse.json({ error: "O mesmo corretor foi informado mais de uma vez neste negócio." }, { status: 400 });
  }
  if (error instanceof Error && error.message.includes("COMMISSION_EXCEEDS_BALANCE")) {
    return NextResponse.json({ error: "O pagamento é maior que o saldo da comissão." }, { status: 400 });
  }
  if (error instanceof Error && error.message === "DEAL_NOT_FOUND") {
    return NextResponse.json({ error: "A negociação não foi encontrada ou foi cancelada." }, { status: 404 });
  }
  if (error instanceof Error && error.message === "INSTALLMENT_BELOW_PAID") {
    return NextResponse.json({ error: "Uma parcela não pode ficar menor que o valor já pago ou recebido." }, { status: 400 });
  }
  if (error instanceof Error && error.message === "PAID_INSTALLMENT_REMOVE") {
    return NextResponse.json({ error: "Uma parcela com baixa não pode ser excluída. Ajuste apenas o saldo em aberto." }, { status: 400 });
  }
  if (error instanceof Error && error.message === "BROKER_BALANCE_CONFLICT") {
    return NextResponse.json({ error: "A nova comissão ficaria menor que o total já pago ao corretor. Revise a comissão ou estorne o pagamento antes." }, { status: 400 });
  }
  if (error instanceof Error && error.message === "BUSINESS_TYPE_LOCKED") {
    return NextResponse.json({ error: "Compra ou venda não pode ser trocada depois que existe uma baixa vinculada." }, { status: 400 });
  }
  if (error instanceof Error && error.message === "INSTALLMENT_NOT_FOUND") {
    return NextResponse.json({ error: "Uma das parcelas foi alterada por outra operação. Atualize a tela e tente novamente." }, { status: 409 });
  }
  if (error instanceof Error && error.message === "LINKED_TRANSACTION_LOCKED") {
    return NextResponse.json({ error: "Esta movimentação veio de uma baixa, comissão, transferência ou cheque. Faça a alteração no módulo de origem." }, { status: 409 });
  }
  if (error instanceof Error && error.message === "CATEGORY_NOT_FOUND") {
    return NextResponse.json({ error: "A categoria financeira não existe ou está inativa." }, { status: 400 });
  }
  if (error instanceof Error && error.message === "ENTRY_HAS_SETTLEMENT") {
    return NextResponse.json({ error: "Esta conta possui pagamento ou recebimento. Estorne as baixas antes de cancelar." }, { status: 409 });
  }
  if (error instanceof Error && error.message === "FUNRURAL_ENTRY_MANAGED") {
    return NextResponse.json({ error: "Esta obrigação é somada automaticamente pelos XMLs. Corrija o vínculo fiscal que originou o valor." }, { status: 409 });
  }
  if(error instanceof Error&&error.message==="FUNRURAL_COMPETENCE_INVALID")return NextResponse.json({error:"Informe uma competência mensal válida."},{status:400});
  if(error instanceof Error&&error.message==="FUNRURAL_GUIDE_INVALID")return NextResponse.json({error:"Informe um valor válido para a parcela do Funrural na guia."},{status:400});
  if(error instanceof Error&&error.message==="FUNRURAL_GUIDE_NOT_FOUND")return NextResponse.json({error:"O DARF selecionado não foi encontrado."},{status:404});
  if (error instanceof Error && error.message === "DEAL_HAS_SETTLEMENT") {
    return NextResponse.json({ error: "Este negócio possui pagamento ou recebimento. Estorne as baixas antes de cancelar." }, { status: 409 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Revise os campos informados.", fields: error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("UNIQUE constraint failed")) {
    if(message.includes("cheques.bank_name")||message.includes("cheques.operation_key"))return NextResponse.json({ error: "Este cheque já está cadastrado na carteira." }, { status: 409 });
    if(message.includes("operation_key")||message.includes("operation_unique"))return NextResponse.json({ error: "Esta operação já foi registrada. A tela será atualizada sem duplicar o lançamento." }, { status: 409 });
    return NextResponse.json({ error: "Já existe um cadastro com esses dados." }, { status: 409 });
  }
  if (message.includes("FOREIGN KEY constraint failed")) {
    return NextResponse.json({ error: "O cadastro informado não existe ou está inativo." }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: "Não foi possível concluir a operação." }, { status: 500 });
}
