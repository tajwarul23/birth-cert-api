import divisionsFile from "../data/bd-divisions.json";
import districtsFile from "../data/bd-districts.json";
import upazilasFile from "../data/bd-upazilas.json";

const key = (name: string) => name.trim().toLowerCase();

const divisionIdByName = new Map(
  divisionsFile.divisions.map((d) => [key(d.name), d.id]),
);

const districtIdByDivision = new Map(
  districtsFile.districts.map((d) => [`${d.division_id}:${key(d.name)}`, d.id]),
);

const upazilaInDistrict = new Set(
  upazilasFile.upazilas.map((u) => `${u.district_id}:${key(u.name)}`),
);

export const DIVISION_NAMES = divisionsFile.divisions.map((d)=>d.name);

export type AddressCheck = {ok: true} | {ok: false, field: string, message: string};

export const checkAddress = (division: string, district: string, upazila: string) : AddressCheck =>{

    const divisionId = divisionIdByName.get(key(division));
    if(!divisionId){
        return {ok: false, field:"division", message:`Unknown division. Use one of: ${DIVISION_NAMES.join(", ")}`}
    }

    const districtId = districtIdByDivision.get(`${divisionId}:${key(district)}`);
    if(!districtId){
         return { ok: false, field: "district", message: `${district} is not a district of ${division} division` };
    }
    const isUpazila = upazilaInDistrict.has(`${districtId}:${key(upazila)}`);
    if(!isUpazila)return { ok: false, field: "upazila", message: `${upazila} is not an upazila of ${district} district` }
    return {ok: true}
} 