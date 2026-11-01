(() => {
"use strict";
document.addEventListener("DOMContentLoaded", async () => {
 const link=document.getElementById("adminDashboardLink");
 const api=window.LAYAN_SUPABASE, config=window.LAYAN_CONFIG;
 if(!link||!api?.isAuthenticated?.()) return;
 const session=api.getSession?.();
 if(!session?.access_token) return;
 try {
  const response=await fetch(config.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/rpc/layan_is_admin",{
   method:"POST",headers:{apikey:config.SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:"{}"
  });
  if(response.ok&&await response.json()===true) link.hidden=false;
 } catch(_){}
});
})();