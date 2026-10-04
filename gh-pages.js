const ghpages = require("gh-pages");

ghpages.publish(
  "dist",
  {
    branch: "gh-pages",
    repo: "https://github.com/iamphduc/chess-web.git",
    message: "Deployed to github page",
  },
  () => {
    console.log("Deployed!");
  }
);
