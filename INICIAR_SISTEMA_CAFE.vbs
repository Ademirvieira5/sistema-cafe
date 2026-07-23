Option Explicit

Dim shell, fso, baseDir, envFile, command, http, i, ready
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)

If Not fso.FileExists(fso.BuildPath(baseDir, ".env")) Then
  Set envFile = fso.CreateTextFile(fso.BuildPath(baseDir, ".env"), True)
  envFile.WriteLine "DATABASE_URL=""file:./dev.db"""
  envFile.Close
End If

If ServerIsReady() Then
  shell.Run "http://localhost:3000", 1, False
  WScript.Quit
End If

command = "cmd.exe /c cd /d """ & baseDir & """ && npm run db:generate >> "".sistema-cafe.log"" 2>&1 && npm run db:deploy >> "".sistema-cafe.log"" 2>&1 && npm run dev >> "".sistema-cafe.log"" 2>&1"
shell.Run command, 0, False

For i = 1 To 90
  WScript.Sleep 1000
  If ServerIsReady() Then
    shell.Run "http://localhost:3000", 1, False
    WScript.Quit
  End If
Next

MsgBox "O Sistema Cafe nao iniciou. Consulte o arquivo .sistema-cafe.log na pasta do projeto.", vbExclamation, "Sistema Cafe"

Function ServerIsReady()
  Dim request
  ServerIsReady = False
  On Error Resume Next
  Set request = CreateObject("MSXML2.XMLHTTP")
  request.Open "GET", "http://localhost:3000", False
  request.Send
  If Err.Number = 0 Then
    If request.Status >= 200 And request.Status < 500 Then
      ServerIsReady = True
    End If
  End If
  Err.Clear
  On Error GoTo 0
End Function
