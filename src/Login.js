import { useState, useEffect } from "react";
import {
  User,
  Lock,
  Mail,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Sun,
  Moon,
} from "lucide-react";
import { supabase } from "./supabaseClient";

export default function Login({ onLogin, isDarkMode, toggleTheme }) {
  const [view, setView] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    // 1. Verificação à prova de balas: checa se o link tem o token de recuperação
    if (window.location.hash.includes("type=recovery")) {
      changeView("update-password");
    }

    // 2. O Listener normal do Supabase (caso o evento dispare no tempo certo)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          changeView("update-password");
        }
      }
    );

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // --- A FUNÇÃO VASSOURA: Troca a tela e limpa tudo ---
  const changeView = (newView) => {
    setView(newView);
    setEmail("");
    setPassword("");
    setName("");
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleAuthAction = async () => {
    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (view === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        setSuccessMsg("Conta criada! Faça login para continuar.");
        setEmail("");
        setPassword("");
        setName("");
      } else if (view === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        setPassword("");
        onLogin();
      } else if (view === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setSuccessMsg("Link de recuperação enviado para o seu e-mail!");
        setEmail(""); 
      } else if (view === "update-password") {
        const { error } = await supabase.auth.updateUser({
          password: password,
        });
        if (error) throw error;
        
        setSuccessMsg("Senha atualizada com sucesso! Entrando...");
        
        // Limpa a URL no navegador para tirar aquele token gigante de lá
        window.history.replaceState(null, document.title, window.location.pathname);
        
        // Aguarda 1.5s para a pessoa ler a mensagem e já entra no sistema
        setTimeout(() => {
          onLogin();
        }, 1500);
      }
    } catch (error) {
      setErrorMsg(error.message || "Ocorreu um erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors relative">
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 md:top-6 md:right-6 p-2 md:p-3 rounded-full md:rounded-lg bg-white dark:bg-slate-900 shadow border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        {isDarkMode ? (
          <Sun className="w-5 h-5 md:w-6 md:h-6 text-amber-400" />
        ) : (
          <Moon className="w-5 h-5 md:w-6 md:h-6 text-teal-600" />
        )}
      </button>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            {view === "login" && "Bem-vindo de volta"}
            {view === "register" && "Criar Conta"}
            {view === "recover" && "Recuperar Senha"}
            {view === "update-password" && "Nova Senha"}
          </h1>
          <p className="text-sm text-slate-500">
            {view === "login" && "Acesse seu Planejador Executivo"}
            {view === "register" && "Preencha seus dados para começar"}
            {view === "recover" &&
              "Enviaremos um link de recuperação para seu e-mail"}
            {view === "update-password" && "Digite sua nova senha de acesso"}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-100 text-red-700 text-sm rounded-lg border border-red-200">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-teal-100 text-teal-800 text-sm rounded-lg border border-teal-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {successMsg}
          </div>
        )}

        <div className="space-y-4">
          {view === "register" && (
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-teal-500 dark:text-white"
              />
            </div>
          )}

          {(view === "login" || view === "register" || view === "recover") && (
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="email"
                placeholder="Seu e-mail corporativo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-teal-500 dark:text-white"
              />
            </div>
          )}

          {(view === "login" ||
            view === "register" ||
            view === "update-password") && (
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAuthAction();
                }}
                placeholder={
                  view === "update-password" ? "Digite a nova senha" : "Senha"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-teal-500 dark:text-white"
              />
            </div>
          )}
        </div>

        {view === "login" && (
          <button
            onClick={() => changeView("recover")}
            className="text-sm text-teal-600 dark:text-teal-400 hover:underline w-full text-right cursor-pointer"
          >
            Esqueceu sua senha?
          </button>
        )}

        <button
          onClick={handleAuthAction}
          disabled={isLoading}
          className={`w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            isLoading ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          {isLoading ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {view === "login" && "Entrar"}
              {view === "register" && "Registrar"}
              {view === "recover" && "Enviar Link"}
              {view === "update-password" && "Salvar Nova Senha"}
              {(view === "login" || view === "register") && (
                <ArrowRight className="w-4 h-4" />
              )}
            </>
          )}
        </button>

        {view !== "update-password" && (
          <p className="text-center text-sm text-slate-500">
            {view === "login" ? (
              <>
                Não tem uma conta?{" "}
                <button
                  onClick={() => changeView("register")}
                  className="text-teal-600 font-semibold cursor-pointer hover:underline"
                >
                  Registre-se
                </button>
              </>
            ) : (
              <>
                Já tem uma conta?{" "}
                <button
                  onClick={() => changeView("login")}
                  className="text-teal-600 font-semibold cursor-pointer hover:underline"
                >
                  Entrar
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
