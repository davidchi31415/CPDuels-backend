const DEBUG = process.env.PORT ? false : true;

console.log(DEBUG ? "DEBUG" : "PRODUCTION");
export default DEBUG;