import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, map, of } from "rxjs";

export interface Vehicle {
    invitationToken: string;
    name: string;
    token: string;
    mileage: number;
    mileageReportedDays: number;
}
  
export interface ServiceRecord {
	id: number;
	carId: number;
	mileage: number;
	serviceDate: Date;
	description: string;
	cost: number;
	note: string;
}

export interface ServiceDueRecord {
	carId: number;
	description: string;
	mileage: number;
	month: number,
	lastServiceDate: Date;
	lastServiceMileage: number;
	dueDays: number;
	dueIn: number;
}

@Injectable({
    providedIn: 'root'
  })
export class MaintenanceService {

  private _myGarage = new BehaviorSubject<Vehicle[]>([]);

  myGarage$: Observable<Vehicle[]>;

  constructor(private httpClient: HttpClient
  ) {
    this.myGarage$ = this._myGarage.asObservable();

    this.loadMyGarage();
  }

  private loadMyGarage() {
    this.httpClient.get<Vehicle[]>("/api/vehicle").subscribe((data) => {
      this._myGarage.next(data);
    });
  }

  public submitMileage(invitationToken: string, mileage: number) : Observable<any> {
    return this.httpClient.put<Vehicle[]>(`/api/vehicle/${invitationToken}/mileage/${mileage}`, '');
  }

  public login(email: string, authToken: string) : Observable<any> {
    return this.httpClient.get(`/api/login?email=${email}&authToken=${authToken}`);
  }

  public sendAuth(email: string) : Observable<any> {
    return this.httpClient.get(`/api/sendAuth?email=${email}`);
  }

  public serviceDue(invitationToken: string) : Observable<ServiceDueRecord[]> {
    return this.httpClient.get<ServiceDueRecord[]>(`/api/vehicle/${invitationToken}/service`)
  }

  public serviceCompleted(invitationToken: string, serviceDue: ServiceDueRecord) : Observable<any> {
    return this.httpClient.post<ServiceDueRecord[]>(`/api/vehicle/${invitationToken}/service`, serviceDue)
  }

  public registerVehicle(vehicle: any) : Observable<any> {
    return this.httpClient.post<ServiceDueRecord[]>(`/api/vehicle`, vehicle).pipe(
      map((data) => {
        this.loadMyGarage();
        return data;
      }));
  }

}
