import { mostReadSlugs } from "@/config/mostRead";
import { defaultCategories } from "./categories";
import { staticAdCampaigns, staticSiteSettings } from "./static";
import type { Article, ArticleImage, ContentSource } from "./types";

// CityMood Newsroom content. Real community news, reporting and features
// covering Badagry Central, Badagry West, Olorunda and surrounding divisions.
// Ages are in minutes before "now", so the homepage, Latest times and the
// breaking ticker always look current.

type SeedArticle = Omit<Article, "id" | "publishedAt" | "body" | "author" | "tags" | "featured"> & {
  ageMinutes: number;
  tags?: string[];
  featured?: boolean;
  author?: string;
  body?: string;
};

const DEFAULT_BODY = [
  "CityMood Communications provides verified, independent, and ethical community journalism for the people of Badagry and surrounding divisions.",
  "Our newsroom operates in accordance with strict verification and fairness standards. We welcome story leads, photo reports of community events, and public interest tips from verified residents across Badagry Central, Badagry West, and Olorunda.",
  "Àgbádárìgì Ọjà Ẹ̀kọ́ ṣ reflects the cultural heritage and language of our coastal communities.",
].join("\n\n");

const landscape = (
  n: number,
  alt: string,
  focalPoint?: ArticleImage["focalPoint"],
  credit = "Photo: CityMood",
): ArticleImage => {
  const dims: Record<number, { width: number; height: number }> = {
    1: { width: 2976, height: 1984 },
    2: { width: 902, height: 497 },
    3: { width: 6016, height: 4000 },
    4: { width: 6016, height: 4000 },
    5: { width: 3000, height: 2000 },
    6: { width: 5040, height: 3360 },
    7: { width: 4128, height: 2322 },
    8: { width: 6000, height: 4000 },
  };
  const d = dims[n] ?? { width: 1800, height: 1200 };
  return {
    src: `/seed/landscape-${n}.jpg`,
    alt,
    width: d.width,
    height: d.height,
    focalPoint,
    credit,
  };
};

const portrait = (n: number, alt: string, credit = "Photo: CityMood"): ArticleImage => {
  const dims: Record<number, { width: number; height: number }> = {
    1: { width: 896, height: 1200 },
    2: { width: 2214, height: 3198 },
    3: { width: 2736, height: 3648 },
    4: { width: 360, height: 540 },
  };
  const d = dims[n] ?? { width: 1200, height: 1500 };
  return {
    src: `/seed/portrait-${n}.jpg`,
    alt,
    width: d.width,
    height: d.height,
    credit,
  };
};

const seed: SeedArticle[] = [
  // ── Local News ──
  {
    slug: "nscdc-uncovers-illegal-fake-juice-factory-aradagun-badagry",
    title: "NSCDC uncovers illegal fake fruit juice factory in Aradagun, Badagry; two suspects arrested",
    standfirst:
      "Operatives of the Nigeria Security and Civil Defence Corps raided an unhygienic facility producing counterfeit “Barkas Juice” using untreated well water and chemical dyes under a fake NAFDAC number.",
    category: "local-news",
    ageMinutes: 35,
    featured: true,
    tags: ["breaking", "investigation"],
    readingMinutes: 6,
    author: "CityMood Investigations Desk",
    image: {
      src: "/seed/badagry-juice-raid.jpg",
      alt: "Operatives inspect seized boxes and bottles during an enforcement raid on an illegal factory in Badagry",
      width: 1264,
      height: 848,
      focalPoint: { x: 0.5, y: 0.5 },
      caption:
        "Seized counterfeit beverage batches impounded during the joint enforcement operation in Aradagun, Badagry.",
      credit: "Photo: CityMood / Enforcement Desk",
    },
    body: [
      "Operatives of the Nigeria Security and Civil Defence Corps (NSCDC), Lagos State Command, have uncovered an illegal and clandestine fruit juice manufacturing factory operating within the Aradagun area of Badagry, Lagos State.",
      "During the enforcement operation, which followed extensive surveillance and intelligence reports from alert local residents, security officers arrested two female suspects aged 48 and 50 who were actively supervising production at the premises.",
      "The illegal facility was found mass-producing an adulterated beverage branded as “Barkas Juice” under hazardous and unsanitary conditions. Operatives discovered that the concoction was formulated by mixing raw, untreated well water with granulated sugar, artificial flavoring, industrial citric acid, and chemical food dyes—without any actual fruit content.",
      "Investigators also uncovered counterfeit National Agency for Food and Drug Administration and Control (NAFDAC) registration numbers printed across thousands of labels ready for distribution. Finished batches had already been packaged into cartons for supply to retail markets across Badagry, parts of mainland Lagos, and neighboring southwest states.",
      "The Lagos State Commandant of the NSCDC commended community whistleblowers and confirmed that the premises had been sealed. The seized products and production equipment have been impounded as exhibits, and the suspects will face prosecution following joint verification with NAFDAC regulatory officials.",
    ].join("\n\n"),
  },
  {
    slug: "igbogbele-community-calls-for-dialogue-border-patrol-checkpoint",
    title: "Igbogbele community calls for calm and dialogue after border patrol checkpoint incident in Badagry West",
    standfirst:
      "Community elders and youth leaders in Igbogbele meet with border security commanders, urging structured transit corridors to safeguard residents.",
    category: "local-news",
    ageMinutes: 85,
    tags: ["breaking"],
    readingMinutes: 5,
    author: "CityMood Metro Desk",
    image: landscape(2, "community leaders meeting at town hall in Badagry West"),
    body: [
      "Leaders and residents of the Igbogbele community in Badagry West Local Council Development Area (LCDA) have appealed for calm, constructive engagement, and enhanced safety protocols following a security incident near an immigration border checkpoint along the coastal corridor.",
      "Community representatives convened an emergency stakeholders meeting at the palace of the local Baale, expressing concern over the proximity of operational checkpoints to residential houses and rural market stalls. The session gathered traditional chiefs, youth leaders, commercial motorcycle operators, and representatives of cross-border transport associations.",
      "Speaking after the consultation, community spokespersons urged security agencies along the Seme-Badagry axis to establish clearly demarcated inspection buffer zones away from densely populated residential quarters. They also appealed to youths in the area to maintain order while formal representations are submitted to the Badagry West LCDA leadership and federal border taskforces.",
      "Security officials confirmed that an internal review into the circumstance of the border encounter is underway, reassuring the community of ongoing collaboration to preserve peace and ensure public safety along all transit routes.",
    ].join("\n\n"),
  },
  {
    slug: "seme-border-customs-directive-small-importers-documentation",
    title: "Seme border: what the new customs directive means for small-scale cross-border food traders",
    standfirst:
      "Clearing agents and border command officials clarify streamlined paperwork procedures designed to facilitate legitimate agricultural imports.",
    category: "local-news",
    ageMinutes: 190,
    readingMinutes: 5,
    author: "Dr. Abolaji Sewhude Akande",
    image: landscape(4, "cargo and transport vehicles waiting at Seme border post"),
    body: [
      "Small-scale importers and cross-border traders operating along the Seme border corridor have received updated operational guidance following the release of new trade facilitation directives by the Nigeria Customs Service Seme Area Command.",
      "The revised guidelines seek to simplify clearance documentation for non-commercial and small-scale agricultural commodities, reducing processing bottlenecks for registered traders while strengthening border compliance against prohibited cargo.",
      "Under the new protocols, verified local cooperatives transporting perishable farm produce and staple foodstuffs across the corridor will access dedicated single-window clearance desks at the border terminal. Clearing agents welcomed the measure, noting that previous paperwork delays had resulted in cargo spoilage and unpredictable demurrage charges.",
      "Customs officials emphasized that the relaxation applies strictly to accredited small-volume food merchants, warning that any attempt to smuggle contraband goods or conceal unmanifested freight will be met with immediate seizure and legal sanctions.",
    ].join("\n\n"),
  },
  {
    slug: "ojo-badagry-expressway-reconstruction-agbara-corridor",
    title: "Ojo–Badagry expressway reconstruction reaches final asphalt laying phase near Agbara corridor",
    standfirst:
      "Engineers on the international corridor project report significant progress as transit times between Lagos mainland and Badagry begin to ease.",
    category: "local-news",
    ageMinutes: 320,
    readingMinutes: 6,
    author: "CityMood Newsroom",
    image: landscape(1, "road reconstruction and paving along expressway corridor"),
    body: [
      "Commuters and transport operators along the Lagos–Badagry Expressway have experienced noticeable relief as contractors handling the federal corridor expansion reached the final asphalt laying phase on the dual carriageway stretch approaching Agbara.",
      "The project, which forms a vital leg of the multinational Lagos–Abidjan corridor, has faced periodic delays caused by heavy seasonal rainfall and complex utility relocations. However, the completion of major drainage culverts and median barriers over recent weeks has enabled round-the-clock paving operations.",
      "Commercial bus operators at the Badagry Roundabout confirmed that travel times to Mile 2 and Alaba International have dropped substantially during off-peak hours. Business owners along the corridor have also reported a steady resurgence in footfall and interstate logistics delivery.",
      "Federal Ministry of Works supervisors affirmed that finishing works on street lighting, road markings, and designated pedestrian bridges will proceed concurrently to ensure maximum commuter safety before the official commissioning.",
    ].join("\n\n"),
  },
  {
    slug: "badagry-general-hospital-maternal-health-unit-expansion",
    title: "Badagry General Hospital expands maternal and child healthcare facilities in Ajara",
    standfirst:
      "The newly upgraded 40-bed maternal wing provides advanced neonatal care, solar backup power, and modernized delivery suites for the division.",
    category: "local-news",
    ageMinutes: 1400,
    readingMinutes: 4,
    author: "Joy Agu",
    image: landscape(6, "modernized healthcare facility entrance at Badagry General Hospital"),
    body: [
      "Healthcare delivery in Badagry received a substantial boost following the commissioning of an expanded maternal and child health complex at Badagry General Hospital in Ajara.",
      "The modernized facility features 40 dedicated maternity beds, two fully equipped surgical delivery suites, a specialized neonatal intensive care unit (NICU) with modern incubators, and a standalone solar inverter array to guarantee uninterrupted power supply.",
      "Medical Director Dr. Olatunde Gbenga noted that the facility was designed to eliminate referral delays for high-risk pregnancies from outlying riverine and coastal communities, including Topo, Ajido, and Gberefu.",
      "Community women leaders who toured the complex commended the Lagos State Ministry of Health for the investment, urging residents across Badagry Central, Olorunda, and Badagry West LCDAs to utilize the center for antenatal checkups and safe hospital deliveries.",
    ].join("\n\n"),
  },
  {
    slug: "marine-police-waterways-safety-patrols-badagry-creek",
    title: "Marine police step up waterway patrols and safety compliance along Badagry Creek",
    standfirst:
      "Boat operators and passenger guilds welcome increased life jacket enforcement and evening patrols on the lagoon routes.",
    category: "local-news",
    ageMinutes: 2100,
    readingMinutes: 4,
    author: "CityMood Metro Desk",
    image: null,
    body: [
      "The Marine Division of the Nigeria Police Force in Badagry has launched enhanced waterway monitoring operations along the Badagry Creek and lagoon transit lines linking Badagry Marina, Ajido, and coastal settlements.",
      "The exercise involves surprise checks at passenger jetties to enforce 100% life-jacket compliance, inspect hull integrity on commercial wooden and fiberglass boats, and restrict night voyages after designated curfew hours.",
      "Leaders of the Maritime Workers Union and the Badagry Boat Operators Guild endorsed the safety push, remarking that professional standards are essential to bolster passenger confidence as water transport becomes an increasingly popular alternative to highway transit.",
      "Officers will also maintain coordinated patrol posts along waterway junctions to deter illegal sand dredging and ensure unhindered passage for legitimate artisanal fishing fleets.",
    ].join("\n\n"),
  },

  // ── Community & People ──
  {
    slug: "marina-heritage-guide-slave-route-difficult-history",
    title: "“We carry this history with care so future generations will remember”",
    standfirst:
      "Senior heritage guide Babatunde Sewanu on the questions visitors ask along the slave trail, and the silence at the ocean shore.",
    category: "community-people",
    ageMinutes: 380,
    role: "Senior Heritage Guide",
    place: "Gberefu",
    readingMinutes: 4,
    author: "Dr. Abolaji Sewhude Akande",
    image: portrait(3, "Babatunde Sewanu at the Badagry waterfront"),
    body: [
      "For over twenty years, Babatunde Sewanu has walked the historic trail across Gberefu Island to the Point of No Return several times each week, escorting historians, schoolchildren, and diaspora pilgrims from across the globe.",
      "“Every group brings a different energy,” he reflects, looking out over the tranquil lagoon waters at Marina jetty. “Some visitors arrive with tears, others with deep quiet questions. Our duty is never to sensationalize or rush the journey, but to speak the truth with dignity and honor the memory of those who walked before us.”",
      "Sewanu learned the history from his grandfather, who was among the early custodians of Badagry’s oral traditions. Today, he trains younger guides in archival accuracy, respectful decorum, and the significance of monuments like the Attenuation Well and the oceanfront memorial arch.",
      "“When visitors reach the Atlantic shore and look out at the open water, words usually fall away,” he says. “That silence is where understanding begins.”",
    ].join("\n\n"),
  },
  {
    slug: "topo-canoe-builder-preserving-coastal-woodworking-craft",
    title: "“My grandfather’s adze still shapes the finest hulls on the lagoon”",
    standfirst:
      "Master woodworker Gabriel Hunsu in Topo on timber selection, river currents, and boats built to outlast decades of tides.",
    category: "community-people",
    ageMinutes: 850,
    role: "Master Boatbuilder",
    place: "Topo",
    readingMinutes: 4,
    author: "Joy Agu",
    image: portrait(1, "Gabriel Hunsu in his woodworking boat yard"),
    body: [
      "In his open-air workshop nestled among towering palm trees at Topo water’s edge, 62-year-old Gabriel Hunsu selects a curved adze with a well-worn mahogany handle—a tool handed down through three generations of canoe builders.",
      "“Modern fiberglass boats have their place, but a hand-hewn hardwood canoe has life in it,” Hunsu smiles as wood shavings curl beneath his blade. “It sits in the water differently, rides the lagoon chop with stability, and lets a fisherman feel the current through his feet.”",
      "Hunsu crafts bespoke fishing vessels and passenger canoes from sustainably harvested Apa and Obeche timber, using natural waterproofing tree resins passed down by Ogu master artisans.",
      "With two apprentices currently learning the trade under his watchful eye, Hunsu is determined to ensure that indigenous woodworking remains a proud, thriving trade for Badagry’s coastal youth.",
    ].join("\n\n"),
  },
  {
    slug: "agbalata-fish-trader-thirty-years-coastal-commerce",
    title: "Thirty years at the same stall, and still the first to open at dawn",
    standfirst:
      "Market elder Alhaja Risikat Hundeyin on thirty years of coastal fish trade and the market community that raised her family.",
    category: "community-people",
    ageMinutes: 1600,
    role: "Market Elder",
    place: "Agbalata",
    readingMinutes: 4,
    author: "CityMood Newsroom",
    image: portrait(2, "Alhaja Risikat Hundeyin at her market stall in Agbalata"),
    body: [
      "Long before the first morning rays crest the horizon over Agbalata Market, Alhaja Risikat Hundeyin is already at her waterfront stall, inspecting the overnight catch brought in by artisanal fishermen from Ajido and Topo.",
      "For three decades, Hundeyin has occupied the same central stall in the fresh seafood section, earning a reputation among wholesale buyers from Lagos and Abeokuta for uncompromising honesty and the freshest lagoon sole, barracuda, and silver catfish.",
      "“This stall paid for four university degrees,” she beams proudly. “It wasn’t easy during the fuel shortages or when the rains flooded the access road, but we market women know how to pull together as one family.”",
      "As vice president of the fish traders cooperative, she mentors young women entering the trade, teaching them financial literacy, price negotiation, and the vital importance of cooperative savings.",
    ].join("\n\n"),
  },
  {
    slug: "ajara-youth-educator-cultural-preservation-initiatives",
    title: "The educator who made Badagry heritage a classroom adventure",
    standfirst:
      "Teacher and cultural advocate Folashade Akran on teaching local history, oral folklore, and digital skills to young pupils.",
    category: "community-people",
    ageMinutes: 2500,
    role: "Heritage Educator",
    place: "Ajara",
    readingMinutes: 4,
    author: "Dr. Abolaji Sewhude Akande",
    image: portrait(4, "Folashade Akran in a classroom in Ajara"),
    body: [
      "When Folashade Akran began teaching social studies at a primary school in Ajara seven years ago, she noticed that pupils knew more about foreign superhero movies than the extraordinary history of their own ancient hometown.",
      "“Badagry is an open-air museum of world history, yet our children walked past historic monuments every day without understanding what they represented,” she explains.",
      "Akran launched an extracurricular heritage club that pairs history lessons with walking excursions, traditional drumming workshops, and digital photo journaling. Her students interview grandparents, record local proverbs, and publish mini cultural zines.",
      "Her innovative curriculum has since been adopted by five neighboring schools, proving that when children connect with their roots, their confidence and academic enthusiasm soar.",
    ].join("\n\n"),
  },
  {
    slug: "lagos-beach-cleaners-remove-two-tons-plastic-badagry-coastline",
    title: "Lagos Beach Cleaners and local volunteers remove two tons of marine plastic along Badagry coastline",
    standfirst:
      "Environmental youth volunteers and coastal fishermen team up for a weekend beach recovery drive across Gberefu and Topo beaches.",
    category: "community-people",
    ageMinutes: 340,
    readingMinutes: 4,
    author: "CityMood Newsroom",
    image: landscape(7, "volunteers removing plastic debris on Badagry beach"),
    body: [
      "More than two hundred young volunteers, environmental enthusiasts, and local fishing families gathered across Badagry’s outer barrier beaches for a large-scale coastal cleanup initiative organized by Lagos Beach Cleaners in partnership with CityMood community champions.",
      "Armed with reusable collection sacks and sorting gloves, participants combed through three kilometres of shoreline stretching from Gberefu Point to Topo beach, recovering discarded plastic bottles, fishing nets, and styrofoam debris washed ashore by Atlantic ocean currents.",
      "Organizers revealed that over two metric tons of recyclable waste were gathered during the four-hour exercise. The plastics were sorted on-site and transported via boat to a certified recycling facility in Lagos.",
      "Community leader and volunteer mentor Abolaji Akande commended the young volunteers, emphasizing that protecting Badagry’s marine environment is direct protection of the local artisanal fishing economy and the region’s ecotourism potential.",
    ].join("\n\n"),
  },
  {
    slug: "stakeholder-dialogue-address-rural-electrification-topo-isalu",
    title: "Stakeholders dialogue addresses rural electrification and transformer upgrades in Topo and Isalu",
    standfirst:
      "Community development associations meet with distribution company representatives over power reliability.",
    category: "community-people",
    ageMinutes: 1050,
    readingMinutes: 4,
    author: "Joy Agu",
    image: null,
    body: [
      "Community Development Associations (CDAs) across Topo, Isalu, and adjoining neighborhoods in Badagry Central convened an interface session with regional representatives of the electricity distribution company to address frequent supply disruptions.",
      "Residents highlighted that rapid population expansion over recent years has severely overloaded existing 33kV distribution transformers, resulting in voltage drops and extended load shedding schedules.",
      "The distribution company’s technical team confirmed that procurement has commenced for three high-capacity replacement transformers designated for critical load centers, with installation slated for completion before the second quarter.",
      "CDA leaders pledged community cooperation and vigilance to protect electrical infrastructure from cable vandalism and unauthorized connections.",
    ].join("\n\n"),
  },

  // ── Business & Development ──
  {
    slug: "badagry-chamber-commerce-hosts-annual-business-conference-youth-centre",
    title: "Badagry Chamber of Commerce hosts annual Business Conference at Youth Centre to boost MSMEs",
    standfirst:
      "Regional trade leaders, entrepreneurs, and financial institutions convene to unlock investment opportunities across Badagry’s coastal economy.",
    category: "business-development",
    ageMinutes: 150,
    readingMinutes: 5,
    author: "Dr. Abolaji Sewhude Akande",
    image: landscape(2, "delegates and entrepreneurs at Badagry Business Conference"),
    body: [
      "The Badagry Chamber of Commerce, Industry, Mines and Agriculture (BACCIMA) convened its flagship Badagry Business Conference at the Badagry Youth Centre, bringing together over four hundred business owners, agro-allied processors, and financial sector experts.",
      "The conference, themed around sustainable local enterprise and cross-border commercial integration, focused on actionable strategies to expand access to low-interest credit, modernize cold-chain logistics for coastal fisheries, and harness the commercial potential of the international Lagos-Seme corridor.",
      "Prominent speakers, including commercial bank executives and cooperative leaders, highlighted the immense opportunities awaiting tech-enabled agro-processing and hospitality investments in Badagry.",
      "Several young entrepreneurs were awarded seed grants and mentorship placements following a business pitch competition hosted during the conference, underscoring the chamber’s commitment to empowering grassroots enterprise.",
    ].join("\n\n"),
  },
  {
    slug: "agbalata-market-traders-embrace-digital-transfers-waterfront-stalls",
    title: "Agbalata International Market traders embrace digital transfers across waterfront stalls",
    standfirst:
      "Fish sellers and fresh produce wholesalers report smoother transactions as digital payment adoption reaches new highs.",
    category: "business-development",
    ageMinutes: 250,
    readingMinutes: 4,
    author: "CityMood Business Bureau",
    image: landscape(8, "traders and shoppers at waterfront market stalls"),
    body: [
      "At Agbalata International Market, the bustling commercial heartbeat of Badagry, trading stalls that once relied exclusively on physical naira notes have widely adopted digital point-of-sale (POS) terminals and instant bank transfers.",
      "Waterfront fish mongers, yam merchants, and imported textiles distributors noted that mobile payment reliability has improved dramatically with expanded telecommunications coverage around the market perimeter.",
      "Market leaders explained that digital transactions have mitigated the risk of nighttime cash theft and enabled traders to settle wholesale accounts with suppliers in Lagos, Republic of Benin, and Togo directly from their smartphones.",
      "Trader associations continue to engage local financial service providers to lower transaction fees and offer micro-insurance products tailored to perishable food vendors.",
    ].join("\n\n"),
  },
  {
    slug: "gberefu-coconut-farmers-cooperative-direct-processing-deals",
    title: "Gberefu coconut farmers cooperative seals direct supply pact with Lagos agro-processing hubs",
    standfirst:
      "Forty plantation owners bypass third-party brokers to supply raw coconut and cold-pressed oil directly to FMCG manufacturers.",
    category: "business-development",
    ageMinutes: 510,
    readingMinutes: 4,
    author: "CityMood Newsroom",
    image: landscape(3, "coconut plantation and harvesting along Gberefu peninsula"),
    body: [
      "The Gberefu Coconut Growers and Processing Cooperative has concluded landmark direct-supply agreements with two leading industrial food and cosmetics processors based in Ikeja and Agbara.",
      "The cooperative, which represents forty family-run coconut groves spanning the Gberefu peninsula, was formed to eliminate exploitative intermediary markups and guarantee stable farmgate prices throughout the harvesting calendar.",
      "Under the partnership terms, the cooperative will supply twenty thousand matured coconuts weekly alongside certified extra virgin coconut oil processed using modern mechanical expellers installed at their local processing hub.",
      "Cooperative executives stated that proceeds from the contracts will fund seedling replanting schemes, pest management training, and educational scholarships for children of cooperative members.",
    ].join("\n\n"),
  },
  {
    slug: "solar-cold-chain-hub-marina-jetty-reduces-fish-losses",
    title: "Solar cold-chain storage hub at Marina jetty reduces post-catch losses for artisanal fishermen",
    standfirst:
      "The communal cold room allows fishermen from Ajido and Topo to store night catches, stabilizing market prices.",
    category: "business-development",
    ageMinutes: 880,
    readingMinutes: 4,
    author: "Joy Agu",
    image: landscape(4, "solar-powered cold storage hub by Marina jetty"),
    body: [
      "Artisanal fishing families operating across the Badagry lagoon basin have welcomed the inauguration of a community-managed solar cold-storage hub located at the Marina jetty.",
      "The facility, powered entirely by an 8kW solar rooftop system with lithium battery storage, provides dependable walk-in refrigeration capable of holding five metric tons of fresh fish.",
      "Previously, fishermen who returned with abundant night catches were frequently forced to sell their catch at distressed prices to prevent spoilage before morning trading opened at Agbalata Market.",
      "With affordable daily crate storage fees, local fishermen can now preserve their haul in prime condition, evening out supply spikes and ensuring fair market returns for their labor.",
    ].join("\n\n"),
  },
  {
    slug: "badagry-hospitality-operators-prepare-summer-tourist-influx",
    title: "Badagry hospitality operators upgrade facilities ahead of annual cultural tourism influx",
    standfirst:
      "Guesthouses, beach resorts, and waterfront dining spots report strong advance bookings for festival and heritage season.",
    category: "business-development",
    ageMinutes: 1650,
    readingMinutes: 4,
    author: "CityMood Business Bureau",
    image: landscape(5, "beachfront resort and guesthouse along Badagry coast"),
    body: [
      "Hotels, beachfront lodges, and heritage guesthouses across Badagry Central and along the scenic coconut belt have initiated extensive facility renovations ahead of the anticipated summer tourism peak.",
      "Operators have invested in upgraded solar energy backups, high-speed Wi-Fi, and guided excursion partnerships connecting guests directly with licensed boat tour guides, historical shrines, and traditional craft markets.",
      "The Badagry Hoteliers and Tourism Stakeholders Association noted that demand from Nigerian diaspora travelers and corporate retreat organizers has surged over recent months.",
      "Association representatives are coordinating with local authorities to ensure reliable road signage, clean beaches, and visible security patrols throughout the holiday season.",
    ].join("\n\n"),
  },
  {
    slug: "pos-merchants-financial-inclusion-badagry-border-axis",
    title: "Agency banking network expands financial access across riverine settlements",
    standfirst:
      "Mobile money operators provide cash-in and cash-out points to Topo, Ajido, and Iworo fishing communities.",
    category: "business-development",
    ageMinutes: 2200,
    readingMinutes: 3,
    author: "CityMood Newsroom",
    image: null,
    body: [
      "Financial inclusion has made significant strides across the riverine settlements of Badagry with the rapid growth of accredited agency banking operators.",
      "Residents of Topo, Ajido, and Iworo who previously had to travel several kilometers by boat to reach commercial bank branches in Badagry town can now perform withdrawals, fund transfers, and utility bill payments at local agent kiosks.",
      "Operators report that mobile banking has especially benefited small-scale fish smokers, vegetable farmers, and village artisans who operate outside conventional banking hours.",
      "Community leaders commended the financial service providers, urging further expansion into more distant island communities along the lagoon corridor.",
    ].join("\n\n"),
  },

  // ── Politics & Public Affairs ──
  {
    slug: "badagry-west-lcda-reviews-grassroots-drainage-road-works",
    title: "Badagry West LCDA leadership reviews grassroots road rehabilitation and flood drainage expansion",
    standfirst:
      "Council chairman and works supervisors inspect culverts in Kankon and Apa ahead of early seasonal rains.",
    category: "politics-public-affairs",
    ageMinutes: 65,
    tags: ["breaking"],
    readingMinutes: 4,
    author: "CityMood Metro Desk",
    image: landscape(5, "council officials inspecting infrastructure civil works"),
    body: [
      "The executive management of Badagry West Local Council Development Area (LCDA) conducted comprehensive on-site inspections of primary drainage culverts and link road grading works across several borderline communities.",
      "The inspection team, led by council engineers and works supervisors, evaluated completed civil works in Kankon, Apa, and surrounding residential clusters where seasonal torrential downpours have historically caused waterlogging and disrupted farm-to-market mobility.",
      "Council officials confirmed that desilting crews will clear primary channels connecting local streams to the lagoon over the coming fortnight. Contractors handling concrete culvert extensions were directed to accelerate timelines to prevent rain interruptions.",
      "Community representatives who met the inspection delegation expressed gratitude for the prompt intervention, while requesting additional grading of connecting feeder roads to sustain school transit during the rainy months.",
    ].join("\n\n"),
  },
  {
    slug: "badagry-media-group-champions-verified-community-journalism",
    title: "Badagry Media Group chairman urges verified reporting and community advocacy",
    standfirst:
      "Media practitioners across the division gather in Ajara to discuss digital ethics, accurate sourcing, and local development coverage.",
    category: "politics-public-affairs",
    ageMinutes: 275,
    readingMinutes: 5,
    author: "Dr. Abolaji Sewhude Akande",
    image: landscape(6, "journalists and media editors at roundtable in Ajara"),
    body: [
      "Practicing journalists, community bloggers, and digital media publishers across the Badagry Division met at the Ajara Media Centre under the auspices of the Badagry Media Group to chart strategic priorities for regional news reporting.",
      "The roundtable focused on enhancing journalistic rigour, eliminating unverified social media rumours, and deepening developmental journalism that shines a spotlight on community needs, healthcare milestones, and cultural preservation.",
      "In his keynote remarks, Dr. Sewhude Akande emphasized that local media outfits bear a sacred responsibility to serve as the authentic voice of the grassroots, balancing vigilance against social vices with proactive celebration of communal progress.",
      "The assembly resolved to establish a peer-review verification desk for breaking community alerts and conduct regular digital reporting masterclasses for emerging young writers across Badagry.",
    ].join("\n\n"),
  },
  {
    slug: "council-legislative-arm-confirms-public-hearing-market-levies",
    title: "Badagry Council legislative arm confirms public hearing on market infrastructure and trader welfare",
    standfirst:
      "Council legislators announce open dialogue with market executives to address stall allocations, sanitation, and security levies.",
    category: "politics-public-affairs",
    ageMinutes: 420,
    readingMinutes: 4,
    author: "Joy Agu",
    image: landscape(7, "Badagry Local Government council chamber session"),
    body: [
      "The Legislative Council of Badagry Local Government has scheduled an open public hearing on proposed amendments to municipal market regulations and stall sanitation levies.",
      "The announcement followed representations made by trader associations requesting transparent accounting of market sanitation dues and improved municipal maintenance of access roads and waste disposal bays around market grounds.",
      "House leader Hon. Babatunde Hunpe stated that the legislative chamber is committed to creating an enabling commercial climate where small traders are supported rather than burdened with duplicate levies.",
      "Representatives from all recognized market guilds, transport unions, and civil society observers have been invited to submit memoranda ahead of the televised council debate next Tuesday.",
    ].join("\n\n"),
  },
  {
    slug: "explainer-federal-state-council-responsibilities-badagry-roads",
    title: "Explainer: federal, state or council — who is responsible for each arterial road leading into Badagry?",
    standfirst:
      "We trace five major corridors across the division and the public works authorities responsible for maintaining them.",
    category: "politics-public-affairs",
    ageMinutes: 920,
    readingMinutes: 5,
    author: "CityMood Newsroom",
    image: null,
    body: [
      "Commuters navigating the Badagry division frequently encounter varying road surface conditions, prompting confusion over which tier of government holds maintenance jurisdiction for each route.",
      "The Lagos–Badagry Expressway, spanning from Eric Moore through Agbara to Seme Border, is a designated federal highway under the direct supervision of the Federal Ministry of Works.",
      "In contrast, key connecting thoroughfares such as the Badagry–Topo–Idale Road and the Joseph Dosu Way are managed by the Lagos State Ministry of Works and Infrastructure through the Lagos State Public Works Corporation (LSPWC).",
      "Internal access streets, residential avenues in Ajara, and rural link roads fall under the statutory purview of Badagry Local Government and the respective LCDAs.",
      "Clear understanding of jurisdictional boundaries empowers community development associations to direct infrastructure petitions to the appropriate engineering agency.",
    ].join("\n\n"),
  },
  {
    slug: "youth-development-forum-dialogue-grassroots-representation",
    title: "Badagry Youth Development Forum convenes dialogue on civic participation",
    standfirst:
      "Youth delegates from across three council areas advocate for structured vocational training and digital hubs.",
    category: "politics-public-affairs",
    ageMinutes: 1850,
    readingMinutes: 4,
    author: "CityMood Metro Desk",
    image: null,
    body: [
      "Youth leaders from Badagry Central, Olorunda, and Badagry West gathered for the quarterly Badagry Youth Development Forum to address civic participation and economic empowerment.",
      "The convention spotlighted the imperative of equipping coastal youths with in-demand technical skills in solar installation, maritime mechanics, digital coding, and creative media production.",
      "Delegates drafted a ten-point policy memorandum addressed to the state youth ministry, recommending the establishment of community innovation workspaces equipped with high-speed internet in each council area.",
      "Forum executives called on young people across the division to participate constructively in community governance and register actively for upcoming civic elections.",
    ].join("\n\n"),
  },

  // ── Culture & Events ──
  {
    slug: "ogu-sato-drummers-dance-troupes-heritage-festival-ajido",
    title: "Drums at dusk: Sato drummers and Ogu cultural troupes gather in Ajido for heritage festival",
    standfirst:
      "Traditional performers from across Badagry showcase historic rhythms, acrobatics, and oral poetry drawing cultural enthusiasts to the lagoon shore.",
    category: "culture-events",
    ageMinutes: 580,
    readingMinutes: 5,
    author: "CityMood Culture Desk",
    image: {
      src: "/seed/badagry-performers.jpg",
      alt: "Cultural performers in cowrie headdresses dancing with sticks around a large carved Sato drum in Badagry",
      width: 2048,
      height: 941,
      focalPoint: { x: 0.5, y: 0.4 },
      caption:
        "Sato drummers and Ogu cultural troupes performing during the heritage festival in Badagry.",
      credit: "Photo: CityMood",
    },
    body: [
      "As the late afternoon sun cast golden reflections across the waters of the Badagry lagoon at Ajido, the thunderous, resonant beat of the sacred Sato drum reverberated across the festival grounds, heralding the opening of the Ogu Cultural Heritage Festival.",
      "Troupes representing historic communities—from Ajido, Topo, and Iworo to Pota and Apa—gathered in full traditional ceremonial regalia. Dancers wearing intricate cowrie-embroidered headdresses and woven raffia skirts executed gravity-defying leaps and synchronized stick dances that have been passed down through generations.",
      "The towering Sato drums, carved from solid hardwood tree trunks and adorned with symbolic ancestral motifs, hold deep sacred significance in Ogu cosmology. Master drummers explained that the drums were traditionally sounded during moments of communal triumph, harvest thanksgiving, and historic transitions.",
      "Cultural elders and visiting scholars praised the younger generation of dancers for keeping the intricate footwork and percussive traditions alive, reaffirming Badagry’s enduring position as a cradle of African artistic resilience.",
    ].join("\n\n"),
  },
  {
    slug: "acm-project-launches-children-cultural-heritage-workshop-badagry",
    title: "African Children’s Cultural Heritage Project launches arts and folklore academy in Badagry",
    standfirst:
      "Youth initiative trains primary school pupils in traditional Ogu drumming, storytelling, and local language literacy.",
    category: "culture-events",
    ageMinutes: 980,
    readingMinutes: 4,
    author: "Dr. Abolaji Sewhude Akande",
    image: landscape(1, "children and instructors participating in cultural arts workshop"),
    body: [
      "Over one hundred school pupils from public and private primary schools in Badagry have enrolled in the newly launched African Children’s Cultural Heritage (ACM) Project holiday academy.",
      "The community initiative, supported by educational stakeholders and cultural advocates, is designed to instill deep appreciation of indigenous history, folk songs, traditional weaving, and Ogu language proficiency among children.",
      "Sessions held at the Badagry Town Hall include daily masterclasses led by veteran storytellers, drumming tutors, and visual artists who guide the youngsters in illustrating folklore tales and mastering basic percussion rhythms.",
      "Project coordinators pointed out that nurturing cultural literacy at an early age provides young people with strong self-identity and creative pride, ensuring that Badagry’s intangible cultural heritage continues to flourish for centuries to come.",
    ].join("\n\n"),
  },
  {
    slug: "badagry-diaspora-festival-preparations-underway-heritage-carnival",
    title: "Badagry Diaspora Festival preparations underway with international heritage delegations confirmed",
    standfirst:
      "Organizing committee reveals highlights for the upcoming carnival, including water regattas, symposiums, and ancestral remembrance walks.",
    category: "culture-events",
    ageMinutes: 1350,
    readingMinutes: 4,
    author: "CityMood Culture Desk",
    image: landscape(8, "water regatta and cultural procession preparations along Marina waterfront"),
    body: [
      "Preparations for the annual Badagry Diaspora Festival have entered high gear following confirmation of attendance from cultural delegations across the Caribbean, Brazil, and North America.",
      "The weeklong celebration, renowned for its colorful lagoon water regatta, street masquerade pageantry, and international academic symposium on African heritage, is expected to attract thousands of visitors.",
      "The planning committee outlined key itinerary highlights, including the ceremonial lighting of the Freedom Flame, choral concerts at the Badagry Marina, and a solemn remembrance walk retracing the historic slave route to Gberefu Island.",
      "Local artisans, culinary vendors, and transport guilds are coordinating to offer visitors an unforgettable, welcoming experience showcasing Badagry’s renowned warmth and hospitality.",
    ].join("\n\n"),
  },
  {
    slug: "badagry-choral-society-triumphs-state-music-championship",
    title: "Badagry Choral Society triumphs at Lagos State indigenous music championship",
    standfirst:
      "The 35-member choir took top honors with their breathtaking performance of traditional Ogu choral hymns.",
    category: "culture-events",
    ageMinutes: 1750,
    readingMinutes: 4,
    author: "Joy Agu",
    image: null,
    body: [
      "The Badagry Choral Society has emerged victorious at the Lagos State Indigenous Choir and Choral Music Championships held at the National Theatre, Iganmu.",
      "Competing against twenty-four choral ensembles from across the state, the 35-member choir captivated the judges with an evocative four-part harmonic arrangement of a 19th-century Ogu thanksgiving hymn, accompanied by acoustic gongs, shakers, and talking drums.",
      "Choir director Emmanuel Whendo praised the singers for their relentless discipline and dedication during weeks of demanding rehearsals at the Anglican Church hall in Badagry.",
      "The ensemble was presented with the championship trophy and a grant to record an album of indigenous coastal choral masterpieces.",
    ].join("\n\n"),
  },

  // ── Tourism & Heritage ──
  {
    slug: "sewhude-akande-appointed-director-general-badagry-tourism-centre",
    title: "CityMood publisher Dr. Abolaji Sewhude Akande appointed pioneer Director General of Badagry Tourism Development Centre",
    standfirst:
      "Aremo of Iworo Kingdom and BTDC Board Chairman Prince Olu Kosoko announced the appointment to spearhead the global promotion of Badagry’s coastal and cultural heritage.",
    category: "tourism-heritage",
    ageMinutes: 120,
    tags: ["tourism", "heritage", "leadership"],
    readingMinutes: 5,
    author: "CityMood Newsroom",
    image: landscape(1, "historic architecture and coconut palm walkway in Badagry Marina"),
    body: [
      "In a milestone development for regional heritage preservation and coastal tourism, Dr. Abolaji Sewhude Akande has been appointed as the pioneer Director General of the Badagry Tourism Development Centre (BTDC) for a three-year tenure.",
      "The announcement was made by the Chairman of the BTDC Board and Aremo of Iworo Kingdom, Prince Olu Kosoko, following extensive consultations with traditional rulers, the Akran of Badagry Kingdom Wheno Aholu Menu-Toyi I, and regional hospitality stakeholders.",
      "Dr. Akande, an honorary doctorate recipient in Arts and Culture and publisher of CityMood Communications, brings over two decades of experience in community media, cultural advocacy, and tourism administration. He previously served as Director of Communications for the Badagry Chamber of Commerce and led numerous grassroots heritage documentation projects across Lagos State.",
      "In his acceptance remarks, Dr. Akande pledged to collaborate closely with indigenous royal institutions, youth organizations, and private investors to elevate Badagry’s historical landmarks onto the global tourism stage while ensuring tangible economic returns for coastal host communities.",
    ].join("\n\n"),
  },
  {
    slug: "first-storey-building-nigeria-restoration-milestone-badagry-marina",
    title: "First Storey Building in Nigeria marks preservation milestone with new archival gallery",
    standfirst:
      "Curators at the historic 1845 mission house complete digital cataloguing of early Yoruba translations and missionary artefacts.",
    category: "tourism-heritage",
    ageMinutes: 450,
    readingMinutes: 4,
    author: "Dr. Abolaji Sewhude Akande",
    image: landscape(2, "the historic First Storey Building in Nigeria (1845) in Badagry Marina"),
    body: [
      "The First Storey Building in Nigeria, constructed in 1845 by the Church Missionary Society along the Badagry Marina waterfront, has unveiled a newly refurbished archival room housing preserved historical documents and interactive displays.",
      "Among the preserved treasures on display is the original English and Yoruba Bible translated by Bishop Samuel Ajayi Crowther, alongside 19th-century church records, early printing implements, and rare photographic archives documenting Badagry’s coastal commerce.",
      "Curators noted that the new temperature-controlled display cases and digital audio guides will significantly enhance visitor engagement, particularly for visiting school excursions and international tourists tracing African heritage.",
      "Stakeholders used the milestone to reiterate calls for enhanced federal monument maintenance and cohesive landscape planning connecting the First Storey Building with the Badagry Heritage Museum and the Marina boardwalk.",
    ].join("\n\n"),
  },
  {
    slug: "gberefu-island-point-of-no-return-trail-conservation-initiative",
    title: "Gberefu Island: conservationists and boat operators advocate sustainable trail management at Point of No Return",
    standfirst:
      "Community custodians on the barrier island call for elevated wooden boardwalks and ecological preservation along the historic route.",
    category: "tourism-heritage",
    ageMinutes: 1100,
    readingMinutes: 5,
    author: "CityMood Heritage Bureau",
    image: landscape(3, "sandy path of the Point of No Return trail towards the Atlantic"),
    body: [
      "Environmental advocates, historic trail guides, and lagoon ferry captains have united under the Gberefu Heritage Coalition to champion ecological preservation and visitor infrastructure along the historic Point of No Return trail.",
      "Each year, tens of thousands of pilgrims, researchers, and diaspora visitors traverse the sandy path crossing Gberefu Island from the lagoon jetty to the Atlantic shore. However, coastal erosion and heavy foot traffic during peak holiday periods have highlighted the need for structured eco-friendly pathways.",
      "The coalition’s proposal includes installing raised treated-timber boardwalks, planting indigenous coconut palms and mangrove buffers to check shoreline retreat, and establishing modern solar-powered sanitation and information kiosks.",
      "Traditional custodians highlighted that preserving the tranquil, sacred atmosphere of the slave trail is essential to honouring the memory of ancestors while fostering responsible cultural tourism that respects local island residents.",
    ].join("\n\n"),
  },
  {
    slug: "oja-heritage-walking-route-historic-landmarks-badagry",
    title: "Ọjà and the ancient quarters: self-guided walking route links Badagry’s earliest landmarks",
    standfirst:
      "Twelve curated stops, historical signboards, and multilingual guidebooks connect the Marina, Vlekete Slave Market, and Brazilian Baracoon.",
    category: "tourism-heritage",
    ageMinutes: 2800,
    readingMinutes: 4,
    author: "CityMood Heritage Bureau",
    image: landscape(4, "historic walking route through old Badagry town"),
    body: [
      "Visitors exploring Badagry town can now navigate a carefully mapped self-guided walking trail linking twelve of the ancient town’s most significant cultural and historic quarters.",
      "The walking circuit begins at the Badagry Marina boardwalk and traverses the historic Vlekete Slave Market (established in 1502), the Brazilian Baracoon, the Mobee Family Slave Relics Museum, and the ancient market square of Ọjà.",
      "Each landmark features weather-resistant interpretive plaques in English, French, and Yoruba, detailing the architectural provenance, social history, and spiritual traditions associated with each site.",
      "Local shopkeepers and craft vendors along the walking corridor reported steady patronage from walking tour groups, praising the initiative for dispersing visitor foot traffic across the historic town center.",
    ].join("\n\n"),
  },

  // ── Uncategorised ──
  {
    slug: "citymood-newsroom-editorial-policy-public-updates",
    title: "CityMood newsroom: verified community reporting guidelines and public submissions",
    standfirst:
      "How readers across Badagry Central, Olorunda, and Badagry West can submit community updates, event announcements, and tips to our reporters.",
    category: null,
    ageMinutes: 4900,
    readingMinutes: 3,
    author: "CityMood Newsroom",
    image: null,
    body: [
      "CityMood Communications remains committed to providing verified, independent, and ethical community journalism for the people of Badagry and surrounding divisions.",
      "Our newsroom operates in accordance with strict verification and fairness standards. We welcome story leads, photo reports of community events, and public interest tips from verified residents across Badagry Central, Badagry West, and Olorunda.",
      "Readers can contact our newsroom team via email at citymoodbadagry@gmail.com or visit our physical office at 10, Agric Road, opposite the Badagry Local Government Secretariat, Ajara.",
    ].join("\n\n"),
  },
];

const authors = [
  "CityMood Newsroom",
  "Dr. Abolaji Sewhude Akande",
  "Joy Agu",
  "CityMood Metro Desk",
  "CityMood Heritage Bureau",
];

export function seedArticles(now: Date = new Date()): Article[] {
  return seed.map(({ ageMinutes, tags = [], featured = false, author, body, ...rest }, i) => ({
    ...rest,
    id: `seed-${i + 1}`,
    body: body ?? DEFAULT_BODY,
    author: author ?? authors[i % authors.length],
    tags,
    featured,
    publishedAt: new Date(now.getTime() - ageMinutes * 60_000).toISOString(),
  }));
}

export const seedSource: ContentSource = {
  categories: async () => defaultCategories,
  articles: async (now) => seedArticles(now),
  frontPage: async (now) => {
    const ids = new Map(seedArticles(now).map((a) => [a.slug, a.id]));
    return {
      leadId: null,
      topIds: [],
      mostReadIds: mostReadSlugs.map((s) => ids.get(s)).filter((id): id is string => !!id),
    };
  },
  adCampaigns: async (now) => staticAdCampaigns(now),
  siteSettings: async () => staticSiteSettings(),
};
