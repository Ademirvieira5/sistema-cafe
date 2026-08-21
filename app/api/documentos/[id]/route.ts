import{NextResponse}from"next/server";import{apiError}from"@/lib/api-response";import{postImportedDocument}from"@/lib/imported-documents";type Context={params:Promise<{id:string}>};
export async function PATCH(request:Request,{params}:Context){try{return NextResponse.json(await postImportedDocument((await params).id,await request.json()))}catch(error){return apiError(error)}}
