let nameAgeMapping = new Map<string, number>();

//1. Add entries
nameAgeMapping.set("Lokesh", 37);
nameAgeMapping.set("Raj", 35);
nameAgeMapping.set("John", 40);

//2. Get entries
let age = nameAgeMapping.get("John");		// age = 40

//3. Check entry by Key
nameAgeMapping.has("Lokesh");		        // true
nameAgeMapping.has("Brian");		        // false

//4. Size of the Map
let count = nameAgeMapping.size; 	        // count = 3

//5. Delete an entry
let isDeleted = nameAgeMapping.delete("Lokesh");	        // isDeleted = true

//6. Clear whole Map
nameAgeMapping.clear();				//Clear all entries
