// ASYUT AQAR — production domain uses production Supabase only.
// Preview, localhost and every unknown host fail over to the isolated TEST project.
const asyutAqarHost = String(window.location?.hostname || "").toLowerCase();
const asyutAqarProductionHost = ["layan-eg.com", "www.layan-eg.com"].includes(asyutAqarHost);

window.LAYAN_CONFIG = asyutAqarProductionHost
  ? {
      ENVIRONMENT: "production",
      SUPABASE_URL: "https://ebyhwqkmhxbgocngpqfe.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_8PlFI202E-pIZRAG61L2sA_aSoJ3Qwt"
    }
  : {
      ENVIRONMENT: "test",
      SUPABASE_URL: "https://wisnmlbefdrkcbbqvdlg.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_Witds4WbdcsSIgfCx1NcOA__lasXKhk"
    };
