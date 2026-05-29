import "dotenv/config";
import app  from  "./app.js"
import  "./src/config/db.js"
import { startCronJobs } from "./src/module/admin/sportmonks/sportmonks.cron.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  startCronJobs();  
});
//  