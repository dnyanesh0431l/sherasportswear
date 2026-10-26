import {
  ArrowRight,
  ChevronRight,
  Headphones,
  Heart,
  Menu,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-white max-w-[1440px] mx-auto overflow-hidden">
      {/* --- Top Bar --- */}
      <div className="bg-[#111111] text-white text-[11px] md:text-xs py-2 px-4 flex justify-between items-center sm:justify-center sm:gap-8 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Truck size={14} className="text-white" />
          <span>
            Free Shipping on Orders Above{" "}
            <span className="text-[#ff5a00] font-bold">₹999</span>
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-gray-400">
          <span>|</span>
          <a href="#" className="hover:text-white transition">
            Track Order
          </a>
          <span>|</span>
          <div className="flex items-center gap-1 hover:text-white transition cursor-pointer">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>Store Locator</span>
          </div>
        </div>
      </div>

      {/* --- Header --- */}
      <header className="px-4 md:px-8 py-4 flex items-center justify-between bg-white">
        <div className="flex items-center gap-4">
          <Menu className="md:hidden w-6 h-6" />
          {/* Logo Area */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 relative flex items-center justify-center">
              {/* Running man icon placeholder using a custom SVG path resembling the logo */}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-full h-full text-black"
              >
                <path
                  d="M13.5 5.5C14.3284 5.5 15 4.82843 15 4C15 3.17157 14.3284 2.5 13.5 2.5C12.6716 2.5 12 3.17157 12 4C12 4.82843 12.6716 5.5 13.5 5.5Z"
                  fill="currentColor"
                />
                <path
                  d="M9 21L11 14L13 16V21H15V14.5L12.5 12L14 9L16 12H19V10H17L14 4L10 5.5L7 9L9 10L11 7.5L9.5 12L6 15L7 17L10 14L9 21Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-2xl md:text-3xl font-black text-[#ff5a00] italic tracking-tighter uppercase">
                Shera
              </span>
              <span className="text-[9px] md:text-[10px] font-bold tracking-widest text-black uppercase mt-0.5">
                Sport's Wear
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <Search className="w-6 h-6 text-black cursor-pointer hidden md:block" />
          <Heart className="w-6 h-6 text-black cursor-pointer" />
          <div className="relative cursor-pointer">
            <ShoppingCart className="w-6 h-6 text-black" />
            <span className="absolute -top-2 -right-2 bg-[#ff5a00] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              2
            </span>
          </div>
        </div>
      </header>

      {/* --- Search Bar --- */}
      <div className="px-4 md:px-8 pb-4">
        <div className="bg-[#f4f4f4] rounded-full flex items-center px-4 py-3 w-full">
          <Search className="w-5 h-5 text-gray-500 mr-3" />
          <input
            type="text"
            placeholder="Search for shoes, apparel, accessories..."
            className="bg-transparent border-none outline-none w-full text-sm text-gray-700 placeholder-gray-500"
          />
        </div>
      </div>

      {/* --- Hero Section --- */}
      <section className="relative bg-[#f9f9f9] mx-4 md:mx-8 rounded-2xl overflow-hidden flex flex-col md:flex-row h-[400px] md:h-[500px]">
        {/* Left Content */}
        <div className="relative z-10 p-8 md:p-12 flex flex-col justify-center h-full w-full md:w-1/2">
          <p className="text-black text-sm tracking-[0.2em] font-semibold mb-2">
            THE PERFECT
          </p>
          <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter uppercase leading-[0.85] mb-4">
            <span className="block text-black">SPORTS</span>
            <span className="block text-[#ff5a00]">WEAR</span>
          </h1>
          <p className="text-black text-xs md:text-sm tracking-[0.2em] font-medium mb-8">
            MOVE BETTER <br /> LIVE BOLDER
          </p>
          <button className="bg-[#ff5a00] text-white font-bold py-3 px-6 rounded-full w-fit flex items-center gap-2 hover:bg-[#e04f00] transition">
            SHOP NOW
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right Image (Using a placeholder to mimic the shoe/runner combo) */}
        <div className="absolute top-0 right-0 w-full h-full md:w-2/3">
          <img
            src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=2070&auto=format&fit=crop"
            alt="Runner and Shoe"
            className="w-full h-full object-cover object-right mask-image-gradient"
            style={{
              maskImage: "linear-gradient(to right, transparent, black 40%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 40%)",
            }}
          />
        </div>

        {/* Carousel Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20 md:left-[25%]">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5a00]"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-white border border-gray-300"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-white border border-gray-300"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-white border border-gray-300"></div>
        </div>
      </section>

      {/* --- Category Cards --- */}
      <section className="px-4 md:px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            title: "FOOTWEAR",
            img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=600&auto=format&fit=crop",
          },
          {
            title: "MEN",
            img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600&auto=format&fit=crop",
          },
          {
            title: "WOMEN",
            img: "https://images.unsplash.com/photo-1518310383802-640c2de311b2?q=80&w=600&auto=format&fit=crop",
          },
          {
            title: "ACCESSORIES",
            img: "https://images.unsplash.com/photo-1575303024507-88257c39ce31?q=80&w=600&auto=format&fit=crop",
          },
        ].map((cat, idx) => (
          <div
            key={idx}
            className="bg-[#f9f9f9] rounded-xl overflow-hidden p-4 flex flex-col items-center justify-between group cursor-pointer h-[200px] md:h-[240px]"
          >
            <div className="w-full h-[120px] md:h-[150px] relative mb-2">
              <img
                src={cat.img}
                alt={cat.title}
                className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition duration-300"
              />
            </div>
            <div className="w-full flex items-center justify-between mt-auto">
              <span className="text-xs md:text-sm font-bold text-black">
                {cat.title}
              </span>
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-gray-400 flex items-center justify-center group-hover:bg-black group-hover:text-white transition">
                <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* --- Trust Badges --- */}
      <section className="px-4 md:px-8 py-6 border-y border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          {
            icon: <Truck className="w-8 h-8 md:w-10 md:h-10 mb-2 text-black" />,
            title: "Fast Delivery",
            sub: "On Orders Above ₹999",
          },
          {
            icon: (
              <ShieldCheck className="w-8 h-8 md:w-10 md:h-10 mb-2 text-black" />
            ),
            title: "100% Original",
            sub: "Genuine Products",
          },
          {
            icon: (
              <RotateCcw className="w-8 h-8 md:w-10 md:h-10 mb-2 text-black" />
            ),
            title: "Easy Returns",
            sub: "Hassle Free",
          },
          {
            icon: (
              <Headphones className="w-8 h-8 md:w-10 md:h-10 mb-2 text-black" />
            ),
            title: "24/7 Support",
            sub: "We're Here to Help",
          },
        ].map((item, idx) => (
          <div key={idx} className="flex flex-col items-center text-center">
            {item.icon}
            <h3 className="text-sm md:text-base font-bold text-black">
              {item.title}
            </h3>
            <p className="text-[10px] md:text-xs text-gray-500">{item.sub}</p>
          </div>
        ))}
      </section>

      {/* --- New Arrivals --- */}
      <section className="px-4 md:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-3xl font-black text-black tracking-tight">
              New Arrivals
            </h2>
            <div className="w-8 h-1 bg-[#ff5a00] mt-1"></div>
          </div>
          <a
            href="#"
            className="text-sm font-semibold flex items-center gap-1 hover:text-[#ff5a00] transition"
          >
            View All <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Product Card 1 */}
          <div className="border border-gray-100 rounded-2xl p-4 flex flex-col relative group hover:shadow-lg transition bg-white">
            <Heart className="absolute top-4 right-4 w-5 h-5 text-gray-400 cursor-pointer hover:text-[#ff5a00] transition" />
            <div className="w-full h-[180px] mb-4 flex items-center justify-center">
              <img
                src="https://images.unsplash.com/photo-1608231387042-66d1773070a5?q=80&w=800&auto=format&fit=crop"
                alt="Columbus NXG 260X"
                className="w-[80%] h-full object-contain mix-blend-multiply group-hover:scale-105 transition duration-300"
              />
            </div>
            <h3 className="text-sm md:text-base font-bold text-black uppercase tracking-wide">
              COLUMBUS NXG 260X
            </h3>
            <p className="text-xs text-gray-500 mb-4">Victory Black / Yellow</p>
            <div className="flex items-center justify-between mt-auto">
              <span className="text-lg font-bold text-black">₹ 2,399</span>
              <button className="bg-black text-white p-2.5 rounded-lg hover:bg-[#ff5a00] transition">
                <ShoppingCart className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Product Card 2 */}
          <div className="border border-gray-100 rounded-2xl p-4 flex flex-col relative group hover:shadow-lg transition bg-white">
            <Heart className="absolute top-4 right-4 w-5 h-5 text-gray-400 cursor-pointer hover:text-[#ff5a00] transition" />
            <div className="w-full h-[180px] mb-4 flex items-center justify-center">
              <img
                src="https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=800&auto=format&fit=crop"
                alt="Columbus NXG 260X"
                className="w-[80%] h-full object-contain mix-blend-multiply group-hover:scale-105 transition duration-300"
              />
            </div>
            <h3 className="text-sm md:text-base font-bold text-black uppercase tracking-wide">
              COLUMBUS NXG 260X
            </h3>
            <p className="text-xs text-gray-500 mb-4">Mist / Aqua</p>
            <div className="flex items-center justify-between mt-auto">
              <span className="text-lg font-bold text-black">₹ 2,399</span>
              <button className="bg-black text-white p-2.5 rounded-lg hover:bg-[#ff5a00] transition">
                <ShoppingCart className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* --- Promo Banner --- */}
      <section className="mx-4 md:mx-8 my-6 rounded-2xl overflow-hidden relative bg-black h-[250px] md:h-[300px] flex items-center">
        {/* Background Image with overlay */}
        <img
          src="https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=2070&auto=format&fit=crop"
          alt="Train Play Repeat"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent"></div>

        <div className="relative z-10 p-8 md:p-12 w-full flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-black italic text-white uppercase leading-none tracking-tighter mb-2">
              TRAIN <br />
              PLAY <br />
              <span className="text-[#ff5a00]">REPEAT</span>
            </h2>
            <p className="text-white text-xs tracking-[0.2em] font-medium mt-4">
              GEAR UP FOR <br /> A STRONGER YOU
            </p>
          </div>
          <button className="bg-white text-black font-bold py-3 px-6 rounded-full mt-6 md:mt-0 flex items-center gap-2 hover:bg-gray-100 transition shadow-lg">
            EXPLORE NOW <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* --- Best Sellers (Header Only to match view) --- */}
      <section className="px-4 md:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-3xl font-black text-black tracking-tight">
              Best Sellers
            </h2>
            <div className="w-8 h-1 bg-[#ff5a00] mt-1"></div>
          </div>
          <a
            href="#"
            className="text-sm font-semibold flex items-center gap-1 hover:text-[#ff5a00] transition"
          >
            View All <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Partial Card Display for visual match */}
          <div className="border border-gray-100 rounded-t-2xl p-4 h-[200px] overflow-hidden relative">
            <Heart className="absolute top-4 right-4 w-5 h-5 text-gray-400" />
            <img
              src="https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=800&auto=format&fit=crop"
              alt="Shoe"
              className="w-full h-[120px] object-contain mt-4 mix-blend-multiply"
            />
          </div>
          <div className="border border-gray-100 rounded-t-2xl p-4 h-[200px] overflow-hidden relative">
            <Heart className="absolute top-4 right-4 w-5 h-5 text-gray-400" />
            <img
              src="https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?q=80&w=800&auto=format&fit=crop"
              alt="Shoe"
              className="w-full h-[120px] object-contain mt-4 mix-blend-multiply"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
