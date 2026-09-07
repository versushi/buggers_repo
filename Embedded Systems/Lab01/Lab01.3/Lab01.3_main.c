#include <msp430.h> 
#define redLED BIT0 // Red LED at P1.0
#define greenLED BIT7 // Green LED at P9.7

void main(void) {
	volatile unsigned int i;
	WDTCTL = WDTPW | WDTHOLD; 	// Stops the Watchdog timer
	PM5CTL0 &= ~LOCKLPM5; 		// Disable GPIO power-on default high-impedance mode

	// Initlize
	P1DIR |= redLED;  // Set pin as output
	P1OUT &= ~redLED; // Turn redLED off
	P9DIR |= greenLED; // Set pin as output
	P9OUT &= ~greenLED; // Turn greenLED off

	for(;;) {
		// Delay Loop
		for(i = 0; i < 20000; i++) {}
		P1OUT ^= redLED; // Toggles the redLED
		P9OUT ^= greenLED; // Toggles the greenLED
	}
	
	// for(;;){
	// 	P1OUT |= redLED; 		// red on
	// 	P9OUT &= ~greenLED; 	//green off
	// 	__delay_cycles(1000000);
	// 	P1OUT &= ~redLED; 		// red Off
	// 	P9OUT |= greenLED; 		// green on
	//  __delay_cycles(1000000);
	// }
}