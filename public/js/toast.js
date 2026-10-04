function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");

    const toast = document.createElement("div");

    // Color Variants
    const variants = {
        success: "bg-dorado-600 text-white",
        error: "bg-red-500 text-white",
        info: "bg-dorado-400 text-white",
    };

    toast.className = `
      px-4 py-3 rounded-lg shadow-lg
      transform transition-all duration-300 ease-out
      translate-x-10 opacity-0
      ${variants[type] || variants.info}
    `;

    toast.innerText = message;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.classList.remove("translate-x-10", "opacity-0");
        toast.classList.add("translate-x-0", "opacity-100");
    }, 10);

    // Auto remove
    setTimeout(() => {
        toast.classList.add("opacity-0", "translate-x-10");
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}
