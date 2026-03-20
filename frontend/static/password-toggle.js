(() => {
  const toggles = document.querySelectorAll("[data-password-toggle]");
  if (!toggles.length) {
    return;
  }

  toggles.forEach((button) => {
    const targetId = button.getAttribute("data-target");
    if (!targetId) {
      return;
    }

    const input = document.getElementById(targetId);
    if (!input) {
      return;
    }

    const openIcon = button.querySelector("[data-eye-open]");
    const closedIcon = button.querySelector("[data-eye-closed]");

    button.addEventListener("click", () => {
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      button.setAttribute("aria-pressed", String(isHidden));
      button.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");

      if (openIcon && closedIcon) {
        openIcon.hidden = isHidden;
        closedIcon.hidden = !isHidden;
      }
    });
  });
})();
