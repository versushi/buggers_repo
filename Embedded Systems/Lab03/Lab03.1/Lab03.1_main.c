#include <msp430.h> 
#include  <stdint.h>


// Declare function
void config_ACLK_to_32KHz_crystal();

// Flashing the LED with Timer_A, continuous mode, via polling
#define redLED BIT0 // Red LED at P1.0
#define greenLED BIT7 // Green LED at P9.7
void main(void) {
// Stop the Watchdog timer & Unlock the GPIO pins
	WDTCTL = WDTPW | WDTHOLD;
	PM5CTL0 &= ~LOCKLPM5;
// Configure the LEDs as output
	P1DIR |= redLED;		// Direct pin 1 as output
	P9DIR |= greenLED; 		// Direct pin 9 as output
	P1OUT &= ~redLED; 		// Turn LED off
	P9OUT &= ~greenLED; 	// Turn LED off
// Configure ACLK to the 32 KHz crystal (function call)
	config_ACLK_to_32KHz_crystal();
// Configure Timer_A
// Use ACLK, divide by 1, continuous mode, clear TAR
	TA0CTL =  TASSEL_1 | ID_2 | MC_2 | TACLR;
// Ensure flag is cleared at the start
	TA0CTL &= ~TAIFG;
// Infinite loop
	for(;;) {
// Wait in this empty loop for the flag to raise
		while((TA0CTL & TAIFG) != TAIFG){} // delay
// Do the action here
		P1OUT ^= redLED; 	// toggle redLED
		TA0CTL &= ~TAIFG;	// Resets flag
	}
}

// Configures ACLK to 32 KHz crystal
void config_ACLK_to_32KHz_crystal() {
// By default, ACLK runs on LFMODCLK at 5MHz/128 = 39 KHz
// Reroute pins to LFXIN/LFXOUT functionality
	PJSEL1 &= ~BIT4;
	PJSEL0 |= BIT4;
	// Wait until the oscillator fault flags remain cleared
	CSCTL0 = CSKEY; // Unlock CS registers
	do {
		CSCTL5 &= ~LFXTOFFG; // Local fault flag
		SFRIFG1 &= ~OFIFG; // Global fault flag
	}
	while((CSCTL5 & LFXTOFFG) != 0);
		CSCTL0_H = 0; // Lock CS registers
	return;
}