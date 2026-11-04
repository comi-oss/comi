(() => {
  const iconMarkup = `__COMI_ICON__`;
  const controlId = "comi-inventory-control";
  const creditId = "comi-pxlkit-credit";

  function installShortcut() {
    const controls = document.querySelector("#ctl");
    if (controls && !document.getElementById(controlId)) {
      const group = document.createElement("div");
      group.className = "ctl-g plate";
      group.id = controlId;

      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", "Inventaris");
      button.title = "Inventaris · booth tersimpan";
      button.innerHTML = iconMarkup;
      button.addEventListener("click", () => {
        const savedBooths = document.querySelector('[data-testid="favs"]');
        if (savedBooths) savedBooths.click();
      });

      group.append(button);
      controls.insertBefore(group, controls.firstElementChild);
    }

    const credit = document.querySelector(".credit");
    if (credit && !document.getElementById(creditId)) {
      const separator = document.createTextNode(" · ");
      const link = document.createElement("a");
      link.id = creditId;
      link.href = "https://pxlkit.xyz";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Icons by Pxlkit";
      link.style.cssText = "color:inherit;text-decoration:underline;text-underline-offset:2px";
      credit.append(separator, link);
    }
  }

  installShortcut();
  new MutationObserver(installShortcut).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
